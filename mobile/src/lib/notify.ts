// Local notifications, scheduled on the phone itself so they fire without internet.
// `planNotifications` is a pure function (unit-tested); `syncNotifications` cancels and re-schedules from it.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Store } from './types';
import { parseYmd, addDays, daysBetween, ymd } from './date';
import { medDueOn, doseKey, supplyDaysLeft, groomDue } from './domain';

export interface PlannedNote {
  at: Date;
  title: string;
  body: string;
  kind: 'med' | 'reminder' | 'overdue' | 'refill' | 'supply' | 'groom' | 'anniversary';
  /** The pet it is about, so tapping it opens that pet's screen. */
  petId?: string;
}

/** iOS keeps at most 64 pending notifications per app; leave a little room. */
export const MAX_NOTES = 60;
const MED_DAYS = 7;
/** Medication alerts may use at most this many slots, so vaccine/document/anniversary notices always fit. */
export const MAX_MED_NOTES = 40;

function at(date: string, time: string): Date {
  const d = parseYmd(date);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Everything that should be scheduled right now, soonest first, capped at MAX_NOTES. */
export function planNotifications(store: Store, now: Date = new Date()): PlannedNote[] {
  if (!store.notifyEnabled) return [];
  const td = ymd(now);
  const pet = (id: string) => store.pets.find((p) => p.id === id)?.name ?? '';
  const out: PlannedNote[] = [];
  const push = (n: PlannedNote) => {
    if (n.at.getTime() > now.getTime()) out.push(n);
  };

  // Medication: each due dose in the next MED_DAYS days that hasn't been checked off.
  for (const m of store.meds) {
    if (!m.notify) continue;
    for (let i = 0; i < MED_DAYS; i++) {
      const day = addDays(td, i);
      if (m.end && day > m.end) break;
      if (!medDueOn(m, day)) continue;
      for (const t of m.times) {
        if (store.doses[doseKey(day, m.id, t)]) continue;
        push({ at: at(day, t), kind: 'med', petId: m.petId, title: `${pet(m.petId)}該吃藥了`, body: `${m.name}${m.dose ? ' · ' + m.dose : ''}（${t}）` });
      }
    }
    if (m.count !== null && m.count !== undefined && m.count <= m.refillAt && (!m.end || m.end >= td)) {
      push({ at: at(addDays(td, now.getHours() < 10 ? 0 : 1), '10:00'), kind: 'refill', petId: m.petId, title: `${pet(m.petId)}的${m.name}快吃完了`, body: `剩 ${m.count} 次，記得回診或補藥。` });
    }
  }

  // Reminders: N days before (default the evening before), the morning of, and up to 3 mornings after if not done.
  for (const r of store.reminders) {
    if (!r.notify || (r.repeat === 'once' && r.doneOnce)) continue;
    const title = `${pet(r.petId)}的${r.title}`;
    const petId = r.petId;
    const days = daysBetween(td, r.date);
    const isDoc = !!r.docId;
    if (days >= 0) {
      const leads = [...new Set((r.lead || []).filter((L) => L > 1))];
      for (const L of leads) push({ at: at(addDays(r.date, -L), '09:00'), kind: 'reminder', petId, title: `${L} 天後：${title}`, body: isDoc ? '記得先辦理更新。' : '記得先預約或準備。' });
      push({ at: at(addDays(r.date, -1), '20:00'), kind: 'reminder', petId, title: `明天：${title}`, body: isDoc ? '明天到期，記得辦理更新。' : '記得先預約或準備。' });
      push({ at: at(r.date, '09:00'), kind: 'reminder', petId, title: `今天：${title}`, body: isDoc ? '今天到期。更新後在文件夾修改到期日。' : '完成後在 PetPal 按「完成」。' });
    }
    for (let k = 1; k <= 3; k++) {
      const d = addDays(r.date, k);
      if (d < td) continue;
      push(
        isDoc
          ? { at: at(d, '09:00'), kind: 'overdue', petId, title: `已過期：${title}`, body: '文件已過期，更新後在文件夾修改到期日。' }
          : { at: at(d, '09:00'), kind: 'overdue', petId, title: `逾期 ${k} 天：${title}`, body: '還沒完成嗎？完成後在 PetPal 按「完成」，或修改日期。' },
      );
      if (isDoc) break; // one notice is enough for an expired document
    }
  }

  // Supplies about to run out (once, next 10:00).
  for (const s of store.supplies) {
    const left = supplyDaysLeft(s);
    if (isFinite(left) && left <= 3) {
      push({ at: at(addDays(td, now.getHours() < 10 ? 0 : 1), '10:00'), kind: 'supply', petId: s.petId, title: `${s.name}快用完了`, body: `${pet(s.petId)}的${s.name}約剩 ${left} 天，記得補貨。` });
    }
  }

  // Grooming due (morning of the due day, next 30 days).
  for (const g of store.groom) {
    const n = groomDue(g, td);
    if (n >= 0 && n <= 30 && g.every > 1) push({ at: at(addDays(td, n), '09:00'), kind: 'groom', petId: g.petId, title: `今天：${pet(g.petId)}的${g.name}`, body: `每 ${g.every} 天一次。` });
  }

  // Birthdays and "came home" anniversaries in the next 60 days.
  for (const p of store.pets) {
    for (const [date, label] of [[p.birthday, '生日'], [p.adopted, '來家週年']] as const) {
      if (!date) continue;
      const y = Number(td.slice(0, 4));
      for (const yy of [y, y + 1]) {
        const md = date.slice(5);
        const occ = md === '02-29' && !((yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0) ? `${yy}-02-28` : `${yy}-${md}`;
        const dd = daysBetween(td, occ);
        if (dd < 0 || dd > 60) continue;
        const years = yy - Number(date.slice(0, 4));
        if (years <= 0) continue;
        push({ at: at(occ, '09:00'), kind: 'anniversary', petId: p.id, title: label === '生日' ? `${p.name} ${years} 歲生日快樂` : `${p.name} 來家 ${years} 週年`, body: '到「里程碑」留下今天的紀念。' });
      }
    }
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  // Medication alerts get at most MAX_MED_NOTES slots, soonest first. If they don't all fit, the last
  // slot tells the user to open the app (opening it schedules the next batch).
  let meds = out.filter((n) => n.kind === 'med');
  if (meds.length > MAX_MED_NOTES) {
    meds = meds.slice(0, MAX_MED_NOTES - 1);
    const last = meds[meds.length - 1].at;
    meds.push({ at: new Date(last.getTime() + 60000), kind: 'med', title: '打開 PetPal 繼續收到用藥提醒', body: '之後的用藥提醒會在你打開 App 時排定。' });
  }
  // Other slots: notices in the next 14 days first, then by importance (reminders/expiry/refill,
  // supplies, grooming, anniversaries), then time — so a far-off notice never pushes out tomorrow's.
  const soon = now.getTime() + 14 * 86400000;
  const rank: Record<PlannedNote['kind'], number> = { reminder: 0, overdue: 0, refill: 0, med: 0, supply: 1, groom: 2, anniversary: 3 };
  const bucket = (n: PlannedNote) => (n.at.getTime() <= soon ? 0 : 1);
  const others = out
    .filter((n) => n.kind !== 'med')
    .sort((a, b) => bucket(a) - bucket(b) || rank[a.kind] - rank[b.kind] || a.at.getTime() - b.at.getTime())
    .slice(0, MAX_NOTES - meds.length);
  return [...meds, ...others].sort((a, b) => a.at.getTime() - b.at.getTime());
}

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

/** A fingerprint of a plan: two plans with the same fingerprint schedule exactly the same notifications. */
export function planSignature(plan: PlannedNote[]): string {
  return plan.map((n) => `${n.at.getTime()}|${n.title}|${n.body}|${n.petId ?? ''}`).join('\n');
}

let chain: Promise<number> = Promise.resolve(0);
/** What is scheduled on the phone right now (null = unknown, so the next sync always runs). */
let scheduledSig: string | null = null;
let scheduledCount = 0;

const handledTaps = new Set<string>();
/**
 * True the first time a notification tap is seen. The tap that launched the app can arrive both from
 * getLastNotificationResponseAsync and the listener, and again after an error-screen retry remounts the app.
 */
export function firstTap(id: string | undefined | null): boolean {
  if (!id) return true;
  if (handledTaps.has(id)) return false;
  handledTaps.add(id);
  return true;
}

/** Which screen tapping a notification opens: a tab name ('health') or a pushed tool screen ('meds', …). */
export function noteRoute(kind: PlannedNote['kind']): string {
  switch (kind) {
    case 'med':
    case 'refill':
      return 'meds';
    case 'supply':
      return 'supplies';
    case 'groom':
      return 'groom';
    case 'anniversary':
      return 'miles';
    default:
      return 'health';
  }
}

/**
 * Cancel everything this app scheduled and schedule it again from the current data. Calls run one at a time.
 * When the plan is the same as what is already scheduled (e.g. after checking off a dose that had no
 * pending alert), nothing is touched. Pass `force` after the user changes notification settings.
 */
export function syncNotifications(store: Store, force = false): Promise<number> {
  chain = chain.then(() => doSync(store, force), () => doSync(store, force));
  return chain;
}

async function doSync(store: Store, force: boolean): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try {
    const plan = planNotifications(store);
    const sig = planSignature(plan);
    if (!force && sig === scheduledSig) return scheduledCount;
    scheduledSig = null;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!store.notifyEnabled) {
      scheduledSig = sig;
      scheduledCount = 0;
      return 0;
    }
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return 0;
    const channelId = Platform.OS === 'android' ? 'default' : undefined;
    const res = await Promise.allSettled(
      plan.map((n) =>
        Notifications.scheduleNotificationAsync({
          content: { title: n.title, body: n.body, data: { route: noteRoute(n.kind), ...(n.petId ? { petId: n.petId } : {}) } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId },
        }),
      ),
    );
    const n = res.filter((x) => x.status === 'fulfilled').length;
    if (n === plan.length) {
      scheduledSig = sig;
      scheduledCount = n;
    }
    return n;
  } catch {
    scheduledSig = null;
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
