// Dose check-in logic shared by the Meds screen and the Today card.
import type { Med, Store } from './types';
import { doseKey, medDueOn } from './domain';

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

/** The dose to show on Today: the earliest one not yet checked in or skipped (overdue first), or null. */
export function nextDose(store: Store, petId: string, day: string): { m: Med; t: string } | null {
  return dosesDue(store, petId, day).find(({ m, t }) => !store.doses[doseKey(day, m.id, t)]) ?? null;
}
