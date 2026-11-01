// Local notifications for reminders and medication times.
// These are scheduled on the phone itself, so they fire even without internet.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Store } from './types';
import { parseYmd, today, addDays } from './date';
import { medActiveOn } from './domain';

let handlerSet = false;

export function initNotifications() {
  if (Platform.OS === 'web' || handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'PetPal 提醒',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

export async function askPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

function at(date: string, time: string): Date {
  const d = parseYmd(date);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Cancel everything this app scheduled and schedule it again from the current data. */
export async function syncNotifications(store: Store): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!store.notifyEnabled) return 0;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return 0;
    const now = Date.now();
    const td = today();
    const pet = (id: string) => store.pets.find((p) => p.id === id)?.name ?? '';
    const jobs: Promise<string>[] = [];
    const channelId = Platform.OS === 'android' ? 'default' : undefined;

    // Reminders: the evening before and the morning of. iOS keeps at most 64 pending, so cap it.
    const upcoming = store.reminders
      .filter((r) => r.notify && !(r.repeat === 'once' && r.doneOnce) && r.date >= td)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(0, 20);
    for (const r of upcoming) {
      const eve = at(addDays(r.date, -1), '20:00');
      const morn = at(r.date, '09:00');
      if (eve.getTime() > now)
        jobs.push(Notifications.scheduleNotificationAsync({
          content: { title: `明天：${pet(r.petId)} ${r.title}`, body: '記得先預約或準備。' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: eve, channelId },
        }));
      if (morn.getTime() > now)
        jobs.push(Notifications.scheduleNotificationAsync({
          content: { title: `今天：${pet(r.petId)} ${r.title}`, body: '完成後在 PetPal 按「完成」。' },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: morn, channelId },
        }));
    }

    // Medication: a daily alarm at each dose time while the course is active.
    for (const m of store.meds.filter((x) => x.notify && (medActiveOn(x, td) || x.start > td))) {
      for (const t of m.times) {
        const [hour, minute] = t.split(':').map(Number);
        jobs.push(Notifications.scheduleNotificationAsync({
          content: { title: `${pet(m.petId)} 該吃藥了`, body: `${m.name}${m.dose ? ' · ' + m.dose : ''}（${t}）` },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId },
        }));
      }
    }
    const ids = await Promise.allSettled(jobs);
    return ids.filter((x) => x.status === 'fulfilled').length;
  } catch {
    return 0;
  }
}

export async function testNotification(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'PetPal 通知測試', body: '看到這則訊息，代表提醒功能正常。' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: Platform.OS === 'android' ? 'default' : undefined },
    });
    return true;
  } catch {
    return false;
  }
}
