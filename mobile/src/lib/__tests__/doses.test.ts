import { applyDose, doseProgress, dosesDue, nextDose, parseDoseKey } from '../doses';
import { emptyStore } from '../seed';
import { doseKey } from '../domain';
import type { Med, Store } from '../types';

const med = (o: Partial<Med> = {}): Med => ({ id: 'm1', petId: 'p1', name: '藥A', dose: '1 顆', times: ['08:00', '20:00'], start: '2026-11-01', end: null, notify: true, freq: 'daily', count: 5, refillAt: 0, ...o });
const mkStore = (meds: Med[]): Store => ({ ...emptyStore(), meds });
const fresh = () => ({ decremented: new Set<string>(), sessionTaken: new Set<string>() });
const D = '2026-11-04';

describe('applyDose', () => {
  test('taking a dose decrements and undo gives it back once', () => {
    const s = mkStore([med()]);
    const mem = fresh();
    applyDose(s, D, 'm1', '08:00', 'taken', mem);
    expect(s.meds[0].count).toBe(4);
    expect(s.doses[doseKey(D, 'm1', '08:00')]).toBe('taken');
    applyDose(s, D, 'm1', '08:00', null, mem);
    expect(s.meds[0].count).toBe(5);
    expect(s.doses[doseKey(D, 'm1', '08:00')]).toBeUndefined();
    applyDose(s, D, 'm1', '08:00', null, mem);
    expect(s.meds[0].count).toBe(5);
  });
  test('a check-in at count 0 takes nothing and gives nothing back', () => {
    const s = mkStore([med({ count: 0 })]);
    const mem = fresh();
    applyDose(s, D, 'm1', '08:00', 'taken', mem);
    applyDose(s, D, 'm1', '08:00', null, mem);
    expect(s.meds[0].count).toBe(0);
  });
  test('un-checking a dose taken before the app started gives a pill back', () => {
    const s = mkStore([med({ count: 2 })]);
    s.doses[doseKey(D, 'm1', '08:00')] = 'taken';
    applyDose(s, D, 'm1', '08:00', 'skip', fresh());
    expect(s.meds[0].count).toBe(3);
    expect(s.doses[doseKey(D, 'm1', '08:00')]).toBe('skip');
  });
  test('untracked count stays null', () => {
    const s = mkStore([med({ count: null })]);
    applyDose(s, D, 'm1', '08:00', 'taken', fresh());
    expect(s.meds[0].count).toBeNull();
  });
});

describe('nextDose', () => {
  test('returns the earliest dose not yet recorded, across meds', () => {
    const s = mkStore([med(), med({ id: 'm2', name: '藥B', times: ['12:00'] })]);
    expect(dosesDue(s, 'p1', D).map((x) => x.t)).toEqual(['08:00', '12:00', '20:00']);
    expect(nextDose(s, 'p1', D)?.t).toBe('08:00');
    s.doses[doseKey(D, 'm1', '08:00')] = 'skip';
    expect(nextDose(s, 'p1', D)).toMatchObject({ t: '12:00' });
    s.doses[doseKey(D, 'm2', '12:00')] = 'taken';
    s.doses[doseKey(D, 'm1', '20:00')] = 'taken';
    expect(nextDose(s, 'p1', D)).toBeNull();
  });
  test('ignores other pets and meds not due', () => {
    const s = mkStore([med({ petId: 'p2' }), med({ id: 'm3', start: '2026-12-01' })]);
    expect(nextDose(s, 'p1', D)).toBeNull();
  });
});

describe('late-night and helpers', () => {
  test("before 03:00 yesterday's missed evening dose comes first", () => {
    const s = mkStore([med({ times: ['08:00', '22:00'] })]);
    expect(nextDose(s, 'p1', D, '01:30')).toMatchObject({ t: '22:00', day: '2026-11-03' });
    s.doses[doseKey('2026-11-03', 'm1', '22:00')] = 'taken';
    expect(nextDose(s, 'p1', D, '01:30')).toMatchObject({ t: '08:00', day: D });
  });
  test('after 03:00 only today counts', () => {
    const s = mkStore([med({ times: ['08:00', '22:00'] })]);
    expect(nextDose(s, 'p1', D, '07:00')).toMatchObject({ t: '08:00', day: D });
  });
  test('parseDoseKey round-trips doseKey', () => {
    expect(parseDoseKey(doseKey(D, 'm1', '08:00'))).toEqual({ date: D, medId: 'm1', time: '08:00' });
  });
  test('doseProgress counts checked and skipped doses', () => {
    const s = mkStore([med()]);
    s.doses[doseKey(D, 'm1', '08:00')] = 'skip';
    expect(doseProgress(s, 'p1', D)).toEqual({ total: 2, done: 1 });
  });
});
