// Dose check-in logic shared by the Meds screen and the Today card.
import type { Med, Store } from './types';
import { doseKey, medDueOn } from './domain';
import { addDays } from './date';

export type DoseState = 'taken' | 'skip' | null;

/**
 * Doses whose check-in actually took a pill off the count, and doses checked in since the app started.
 * Un-checking gives a pill back only when the check-in took one (a check-in at count 0 took nothing),
 * so the count can't creep above what it was. Module level so it survives leaving a screen.
 */
export const doseMemory = { decremented: new Set<string>(), sessionTaken: new Set<string>() };

export function resetDoseMemory() {
  doseMemory.decremented.clear();
  doseMemory.sessionTaken.clear();
}

/** Record a dose state on `d` (an immer draft or a plain store) and keep the pill count in step. */
export function applyDose(d: Store, day: string, medId: string, time: string, v: DoseState, mem = doseMemory) {
  const k = doseKey(day, medId, time);
  const prev = d.doses[k];
  const med = d.meds.find((x) => x.id === medId);
  if (med && med.count !== null && med.count !== undefined) {
    if (prev !== 'taken' && v === 'taken') {
      if (med.count > 0) {
        med.count -= 1;
        mem.decremented.add(k);
      } else mem.decremented.delete(k);
    }
    if (prev === 'taken' && v !== 'taken') {
      // Taken earlier in this run: give back only if it was decremented. Taken before the app started: assume it was.
      const known = mem.sessionTaken.has(k) ? mem.decremented.has(k) : true;
      if (known) med.count += 1;
      mem.decremented.delete(k);
    }
  }
  if (v === 'taken') mem.sessionTaken.add(k);
  if (v) d.doses[k] = v;
  else delete d.doses[k];
}

/** Doses due on `day` for one pet, sorted by time. */
export function dosesDue(store: Store, petId: string, day: string): { m: Med; t: string }[] {
  const out: { m: Med; t: string }[] = [];
  store.meds.filter((m) => m.petId === petId && medDueOn(m, day)).forEach((m) => m.times.forEach((t) => out.push({ m, t })));
  return out.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.m.name.localeCompare(b.m.name)));
}

/** Split a `doses` key back into its parts (see `doseKey` in domain.ts). */
export function parseDoseKey(k: string): { date: string; medId: string; time: string } {
  const [date = '', medId = '', time = ''] = k.split('|');
  return { date, medId, time };
}

/** How many of today's doses for one pet exist and how many are checked in or skipped. */
export function doseProgress(store: Store, petId: string, day: string) {
  const due = dosesDue(store, petId, day);
  return { total: due.length, done: due.filter(({ m, t }) => store.doses[doseKey(day, m.id, t)]).length };
}

/** Until this time, an untaken evening dose from yesterday is still shown first on Today. */
export const LATE_NIGHT_CUTOFF = '03:00';
const EVENING = '18:00';

/**
 * The dose to show on Today: the earliest one not yet checked in or skipped (overdue first), or null.
 * Shortly after midnight (before 03:00) a missed evening dose from yesterday comes first, so a
 * 22:00 dose that was forgotten doesn't disappear at 00:00.
 */
export function nextDose(store: Store, petId: string, day: string, now?: string): { m: Med; t: string; day: string } | null {
  if (now && now < LATE_NIGHT_CUTOFF) {
    const y = addDays(day, -1);
    const late = dosesDue(store, petId, y).find(({ m, t }) => t >= EVENING && !store.doses[doseKey(y, m.id, t)]);
    if (late) return { ...late, day: y };
  }
  const hit = dosesDue(store, petId, day).find(({ m, t }) => !store.doses[doseKey(day, m.id, t)]);
  return hit ? { ...hit, day } : null;
}

/** Toast shown after a dose check-in, the same on Today and in Meds. */
export const doseToast = (name: string, time: string) => `已記錄：${name} ${time} 已服用`;
