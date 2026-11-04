// Business rules shared by several screens.
import type { Store, Reminder, Med, Supply, Entry, Pet, GroomTask } from './types';
import { addDays, addMonths, daysBetween, parseYmd, today, ymd } from './date';

export const KIND_LABEL: Record<Pet['kind'], string> = { dog: '狗', cat: '貓', rabbit: '兔子', bird: '鳥', other: '其他' };
export const SEX_LABEL: Record<string, string> = { male: '公', female: '母', u: '' }; // 'u' = 不確定, shown as nothing

// ---------- Reminders ----------

export type ReminderState = 'overdue' | 'today' | 'soon' | 'later' | 'done';

export function reminderState(r: Reminder, td = today()): { state: ReminderState; days: number } {
  if (r.repeat === 'once' && r.doneOnce) return { state: 'done', days: 0 };
  const days = daysBetween(td, r.date);
  if (days < 0) return { state: 'overdue', days };
  if (days === 0) return { state: 'today', days };
  if (days <= 7) return { state: 'soon', days };
  return { state: 'later', days };
}

export function reminderLabel(r: Reminder): string {
  const { state, days } = reminderState(r);
  if (state === 'done') return '已完成';
  if (state === 'overdue') return `逾期 ${-days} 天`;
  if (state === 'today') return '今天';
  return `${days} 天後`;
}

export const REPEAT_LABEL: Record<Reminder['repeat'], string> = { once: '不重複', monthly: '每月', yearly: '每年' };

/** Mark a reminder done today; repeating ones roll forward to the next date after today. */
export function completeReminder(r: Reminder, td = today()): void {
  r.history = [...(r.history || []), td];
  if (r.repeat === 'once') {
    r.doneOnce = true;
    return;
  }
  let next = r.date;
  const step = (s: string) => (r.repeat === 'monthly' ? addMonths(s, 1) : addMonths(s, 12));
  do next = step(next);
  while (next <= td);
  r.date = next;
}

// ---------- Care tasks ----------

export function tasksFor(store: Store, petId: string) {
  return store.tasks.filter((t) => t.petId === petId).sort((a, b) => (a.time < b.time ? -1 : 1));
}

export function doneBy(store: Store, taskId: string, date = today()): string | undefined {
  return store.taskDone[date]?.[taskId];
}

// ---------- Entries ----------

export function entriesFor(store: Store, petId: string, form?: Entry['form']) {
  return store.entries.filter((e) => e.petId === petId && (!form || e.form === form)).sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function latestGrowth(store: Store, petId: string): { weight: number; length: number | null } | null {
  const g = entriesFor(store, petId, 'growth')[0];
  return g ? { weight: Number(g.v.weight), length: Number(g.v.length) > 0 ? Number(g.v.length) : null } : null;
}

const FOOD: Record<string, string> = { dry: '乾糧', wet: '濕食', hay: '牧草', veg: '蔬菜', water: '飲水', treat: '零食' };
export const FOOD_LABEL = FOOD;
const APP: Record<string, string> = { good: '食慾很好', normal: '食慾普通', poor: '不太吃' };
const HT: Record<string, string> = { symptom: '症狀', med: '用藥', visit: '看診', poop: '排便' };
const STOOL: Record<string, string> = { normal: '正常', soft: '偏軟', hard: '偏硬' };
const SEV: Record<string, string> = { mild: '輕微', moderate: '中等', severe: '嚴重' };
const BODY: Record<string, string> = { thin: '偏瘦', ideal: '理想', chubby: '偏胖' };

export function entrySummary(e: Entry): string {
  const v = e.v || {};
  switch (e.form) {
    case 'feed':
      return [FOOD[v.food] ?? v.food, v.food === 'water' ? `${v.amount} ml` : `${v.amount} 份`, v.food !== 'water' && v.appetite && v.appetite !== 'normal' ? APP[v.appetite] : null, v.note || null]
        .filter(Boolean)
        .join(' · ');
    case 'health': {
      const d = v.hType === 'symptom' ? `${(v.signs || []).join('、')} · ${SEV[v.severity] ?? ''}` : v.hType === 'med' ? v.medName : v.hType === 'visit' ? v.clinic : STOOL[v.stool] ?? '';
      return `${HT[v.hType] ?? '健康'} · ${d}`;
    }
    case 'growth':
      return [`體重 ${v.weight} kg`, v.length ? `${v.length} cm` : null, BODY[v.body] ?? null].filter(Boolean).join(' · ');
    case 'activity':
      return `活動 ${v.min} 分鐘`;
  }
  return '';
}

// ---------- Meds ----------

/** The course covers this date (between start and end). */
export function medActiveOn(m: Med, date: string): boolean {
  return m.start <= date && (!m.end || m.end >= date);
}

/** A dose is due on this date: active, and it is a dosing day for the frequency. */
export function medDueOn(m: Med, date: string): boolean {
  if (!medActiveOn(m, date)) return false;
  const f = m.freq ?? 'daily';
  if (f === 'daily') return true;
  if (f === 'weekly') return daysBetween(m.start, date) % 7 === 0;
  // monthly: same day of month as the start (clamped to the month's last day)
  const s = parseYmd(m.start).getDate();
  const d = parseYmd(date);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === Math.min(s, last);
}

export const FREQ_LABEL = { daily: '每天', weekly: '每週', monthly: '每月' } as const;

export function doseKey(date: string, medId: string, time: string) {
  return `${date}|${medId}|${time}`;
}

/** Next date (from `from`, inclusive) on which a dose is due, or null if the course has ended. */
export function nextDueDate(m: Med, from = today()): string | null {
  for (let i = 0; i < 62; i++) {
    const d = addDays(from, i);
    if (m.end && d > m.end) return null;
    if (medDueOn(m, d)) return d;
  }
  return null;
}

/**
 * Share of scheduled doses taken over the last 7 days (today counts only once marked).
 * Returns pct null when nothing was scheduled.
 */
export function adherence(store: Store, petId: string | null): { sched: number; taken: number; pct: number | null } {
  const td = today();
  let sched = 0;
  let taken = 0;
  for (let i = -6; i <= 0; i++) {
    const day = addDays(td, i);
    store.meds
      .filter((m) => (!petId || m.petId === petId) && medDueOn(m, day))
      .forEach((m) =>
        m.times.forEach((t) => {
          const st = store.doses[doseKey(day, m.id, t)];
          if (day < td || st) {
            sched++;
            if (st === 'taken') taken++;
          }
        }),
      );
  }
  return { sched, taken, pct: sched ? Math.round((taken / sched) * 100) : null };
}

// ---------- Supplies ----------

/** Stock remaining today, given daily use since the last count. */
export function supplyNow(s: Supply, td = today()): number {
  const used = Math.max(0, daysBetween(s.asOf, td)) * s.use;
  return Math.max(0, Math.round((s.stock - used) * 100) / 100);
}

/** Whole days of stock left; Infinity when no daily use is set. */
export function supplyDaysLeft(s: Supply): number {
  return s.use > 0 ? Math.floor(supplyNow(s) / s.use) : Infinity;
}

export function supplyStatusText(s: Supply): string {
  const left = supplyDaysLeft(s);
  if (supplyNow(s) <= 0) return '已用完';
  if (!isFinite(left)) return '未設定每日用量';
  if (left <= 7) return `快用完了 · 約剩 ${left} 天`;
  return `約剩 ${left} 天`;
}

// ---------- Grooming ----------

export function groomDue(g: GroomTask, td = today()): number {
  return g.every - daysBetween(g.last, td);
}

export function groomDueText(g: GroomTask, td = today()): string {
  const n = groomDue(g, td);
  if (n < 0) return `逾期 ${-n} 天`;
  if (n === 0) return '今天';
  if (n === 1) return '明天';
  return `${n} 天後`;
}

// ---------- Pets ----------

/** "來家第 N 天" (the adoption day is day 1). null when the date is unknown or in the future. */
export function daysTogether(pet: Pet, td = today()): number | null {
  if (!pet.adopted) return null;
  const n = daysBetween(pet.adopted, td);
  return n < 0 ? null : n + 1;
}

// ---------- Misc ----------

export const money = (n: number) => 'NT$' + Math.round(n).toLocaleString('en-US');

export function mapsSearch(q: string) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

/** The pet's vet: the saved 主治醫院, or a contact marked as a hospital. Never a family member or sitter. */
export function primaryVetPhone(store: Store, petId: string): { name: string; phone: string } | null {
  const v = store.vets[petId];
  if (v?.phone) return { name: v.name || '主治醫院', phone: v.phone };
  const isVet = (rel: string) => /醫院|獸醫|醫師/.test(rel);
  const c =
    store.contacts.find((x) => x.petId === petId && isVet(x.rel) && x.primary) ??
    store.contacts.find((x) => x.petId === petId && isVet(x.rel));
  return c ? { name: c.name, phone: c.phone } : null;
}

/** Monthly chores (deworming, heartworm) — not worth a milestone each time. */
export function isRoutineReminder(r: Reminder): boolean {
  return r.repeat === 'monthly';
}

/** File name safe for iOS/Android share sheets. */
export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|\n\r]+/g, '-').trim() || 'petpal';
}

// ---------- First-run helpers ----------

/** One item per calendar week, the same all week (Monday-based week number since 1970). */
export function weeklyPick<T>(list: T[], td: string): T | undefined {
  if (!list.length) return undefined;
  const days = Math.floor(Date.parse(td + 'T00:00:00Z') / 86400000);
  const week = Math.floor((days + 3) / 7); // 1970-01-01 was a Thursday; +3 makes weeks start on Monday
  return list[((week % list.length) + list.length) % list.length];
}

/**
 * Whether Today should suggest a backup: 'never' when nothing was ever exported and there are 20+ records,
 * 'stale' when the last backup is over 30 days old and something was added since. Dismissing sets
 * backupNudgeAt, which silences it for 14 days.
 */
export function backupNudge(store: Store, td: string): 'never' | 'stale' | null {
  const s = store as Store & { lastBackupAt?: string | null; backupNudgeAt?: string | null };
  if (s.backupNudgeAt && daysBetween(s.backupNudgeAt.slice(0, 10), td) < 14) return null;
  const records = store.entries.length + store.journal.length;
  if (!s.lastBackupAt) return records >= 20 ? 'never' : null;
  // lastBackupAt is an ISO time (UTC); compare by the phone's local date like everything else.
  const last = ymd(new Date(s.lastBackupAt));
  if (daysBetween(last, td) <= 30) return null;
  const changed = store.entries.some((e) => e.at.slice(0, 10) > last) || store.journal.some((j) => j.at.slice(0, 10) > last);
  return changed ? 'stale' : null;
}

/** Microchip numbers in Taiwan are 15 digits. Empty is allowed. */
export const validChip = (chip: string) => !chip.trim() || /^\d{15}$/.test(chip.trim());

export type SuggestedReminder = { key: string; title: string; repeat: Reminder['repeat']; months: number };

/** Reminders worth setting up for a new pet of this kind (next date defaults to about a month away). */
export function suggestedReminders(kind: Pet['kind']): SuggestedReminder[] {
  if (kind === 'dog')
    return [
      { key: 'rabies', title: '狂犬病疫苗', repeat: 'yearly', months: 1 },
      { key: 'heartworm', title: '心絲蟲預防', repeat: 'monthly', months: 1 },
      { key: 'deworm', title: '體內外驅蟲', repeat: 'monthly', months: 1 },
    ];
  if (kind === 'cat')
    return [
      { key: 'rabies', title: '狂犬病疫苗', repeat: 'yearly', months: 1 },
      { key: 'fvrcp', title: '三合一疫苗', repeat: 'yearly', months: 1 },
      { key: 'deworm', title: '體內外驅蟲', repeat: 'monthly', months: 1 },
    ];
  return [{ key: 'checkup', title: '年度健康檢查', repeat: 'yearly', months: 1 }];
}

/** Reminder presets with their usual repeat, limited to the kinds they apply to (empty = all kinds). */
export const REMINDER_PRESETS: { title: string; repeat: Reminder['repeat']; kinds: Pet['kind'][] }[] = [
  { title: '狂犬病疫苗', repeat: 'yearly', kinds: ['dog', 'cat'] },
  { title: '八合一疫苗', repeat: 'yearly', kinds: ['dog'] },
  { title: '三合一疫苗', repeat: 'yearly', kinds: ['cat'] },
  { title: '心絲蟲預防藥', repeat: 'monthly', kinds: ['dog', 'cat'] },
  { title: '體內外驅蟲', repeat: 'monthly', kinds: ['dog', 'cat', 'rabbit'] },
  { title: '年度健康檢查', repeat: 'yearly', kinds: [] },
  { title: '回診', repeat: 'once', kinds: [] },
  { title: '剪指甲', repeat: 'monthly', kinds: [] },
];

export const presetsFor = (kind?: Pet['kind']) => REMINDER_PRESETS.filter((p) => !kind || !p.kinds.length || p.kinds.includes(kind));
