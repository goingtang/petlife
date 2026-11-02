// Business rules shared by several screens.
import type { Store, Reminder, Med, Supply, Entry, Pet, GroomTask } from './types';
import { addDays, addMonths, daysBetween, parseYmd, today } from './date';

export const KIND_LABEL: Record<Pet['kind'], string> = { dog: '狗', cat: '貓', rabbit: '兔子', bird: '鳥', other: '其他' };
export const SEX_LABEL = { male: '公', female: '母' } as const;

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

export function latestGrowth(store: Store, petId: string): { weight: number; length: number } | null {
  const g = entriesFor(store, petId, 'growth')[0];
  return g ? { weight: Number(g.v.weight), length: Number(g.v.length) } : null;
}

const FOOD: Record<string, string> = { dry: '乾糧', wet: '濕食', hay: '牧草', veg: '蔬菜', water: '飲水', treat: '零食' };
export const FOOD_LABEL = FOOD;
const APP: Record<string, string> = { good: '食慾很好', normal: '食慾普通', poor: '不太吃' };
export const APPETITE_LABEL = APP;
const HT: Record<string, string> = { symptom: '症狀', med: '用藥', visit: '看診', poop: '排便' };
export const HTYPE_LABEL = HT;
const STOOL: Record<string, string> = { normal: '正常', soft: '偏軟', hard: '偏硬' };
export const STOOL_LABEL = STOOL;
const SEV: Record<string, string> = { mild: '輕微', moderate: '中等', severe: '嚴重' };
export const SEVERITY_LABEL = SEV;
const BODY: Record<string, string> = { thin: '偏瘦', ideal: '理想', chubby: '偏胖' };
export const BODY_LABEL = BODY;

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

// ---------- Misc ----------

export const money = (n: number) => 'NT$' + Math.round(n).toLocaleString('en-US');

export function phoneHref(phone: string) {
  return 'tel:' + phone.replace(/[^0-9+]/g, '');
}

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
