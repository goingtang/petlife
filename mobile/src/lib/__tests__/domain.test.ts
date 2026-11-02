import { completeReminder, reminderState, medDueOn, adherence, supplyNow, supplyDaysLeft, supplyStatusText, groomDue, groomDueText, primaryVetPhone, doseKey, nextDueDate, safeFileName } from '../domain';
import { emptyStore } from '../seed';
import { addDays, today } from '../date';
import type { Med, Reminder, Supply, Store } from '../types';

const med = (over: Partial<Med> = {}): Med => ({
  id: 'm1', petId: 'p1', name: '藥', dose: '', times: ['08:00'], start: '2026-01-10', end: null, notify: true, freq: 'daily', count: null, refillAt: 0, ...over,
});

describe('reminders', () => {
  const r = (over: Partial<Reminder> = {}): Reminder => ({ id: 'r', petId: 'p', title: '狂犬病疫苗', date: '2026-11-05', repeat: 'yearly', notify: true, history: [], ...over });

  test('yearly reminder rolls one year forward', () => {
    const x = r();
    completeReminder(x, '2026-11-05');
    expect(x.date).toBe('2027-11-05');
    expect(x.history).toEqual(['2026-11-05']);
  });

  test('overdue monthly reminder rolls past today, not just one step', () => {
    const x = r({ repeat: 'monthly', date: '2026-08-10' });
    completeReminder(x, '2026-11-02');
    expect(x.date).toBe('2026-11-10');
  });

  test('once reminder is marked done, not overdue', () => {
    const x = r({ repeat: 'once', date: '2026-10-01' });
    expect(reminderState(x, '2026-11-02').state).toBe('overdue');
    completeReminder(x, '2026-11-02');
    expect(reminderState(x, '2026-11-02').state).toBe('done');
  });
});

describe('medication schedule', () => {
  test('daily course respects start and end', () => {
    const m = med({ start: '2026-11-01', end: '2026-11-03' });
    expect(medDueOn(m, '2026-10-31')).toBe(false);
    expect(medDueOn(m, '2026-11-01')).toBe(true);
    expect(medDueOn(m, '2026-11-03')).toBe(true);
    expect(medDueOn(m, '2026-11-04')).toBe(false);
  });

  test('weekly course repeats on the start weekday', () => {
    const m = med({ start: '2026-11-02', freq: 'weekly' });
    expect(medDueOn(m, '2026-11-09')).toBe(true);
    expect(medDueOn(m, '2026-11-10')).toBe(false);
  });

  test('monthly course uses the start day, clamped in short months', () => {
    const m = med({ start: '2026-01-31', freq: 'monthly' });
    expect(medDueOn(m, '2026-02-28')).toBe(true);
    expect(medDueOn(m, '2026-03-31')).toBe(true);
    expect(medDueOn(m, '2026-03-30')).toBe(false);
    expect(nextDueDate(m, '2026-04-01')).toBe('2026-04-30');
  });

  test('adherence is null when nothing was scheduled', () => {
    const s = emptyStore();
    expect(adherence(s, null).pct).toBeNull();
  });

  test('adherence counts past doses and only marked ones today', () => {
    const s = emptyStore();
    const td = today();
    const m = med({ start: addDays(td, -2) });
    s.meds = [m];
    s.doses[doseKey(addDays(td, -2), m.id, '08:00')] = 'taken';
    s.doses[doseKey(addDays(td, -1), m.id, '08:00')] = 'skip';
    const a = adherence(s, null);
    expect(a.sched).toBe(2); // today not marked yet → not counted
    expect(a.taken).toBe(1);
    expect(a.pct).toBe(50);
  });
});

describe('supplies and grooming', () => {
  const sup = (over: Partial<Supply> = {}): Supply => ({ id: 's', petId: 'p', name: '乾糧', unit: 'kg', stock: 2, use: 0.5, pack: 7, asOf: addDays(today(), -2), inCart: false, ...over });

  test('stock decreases with daily use and never goes negative', () => {
    expect(supplyNow(sup())).toBe(1);
    expect(supplyDaysLeft(sup())).toBe(2);
    expect(supplyNow(sup({ asOf: addDays(today(), -10) }))).toBe(0);
    expect(supplyStatusText(sup({ asOf: addDays(today(), -10) }))).toBe('已用完');
  });

  test('zero daily use is not "999 days"', () => {
    expect(supplyDaysLeft(sup({ use: 0 }))).toBe(Infinity);
    expect(supplyStatusText(sup({ use: 0 }))).toBe('未設定每日用量');
  });

  test('grooming due text', () => {
    const td = today();
    const g = { id: 'g', petId: 'p', name: '刷牙', every: 1, last: td, history: [] };
    expect(groomDue(g, td)).toBe(1);
    expect(groomDueText(g, td)).toBe('明天');
    expect(groomDueText({ ...g, every: 7, last: addDays(td, -9) }, td)).toBe('逾期 2 天');
  });
});

describe('vet phone', () => {
  test('never returns a family member as the hospital', () => {
    const s: Store = emptyStore();
    s.contacts = [{ id: 'c', petId: 'p', name: '媽媽', rel: '家人', phone: '0912', primary: true }];
    expect(primaryVetPhone(s, 'p')).toBeNull();
    s.contacts.push({ id: 'h', petId: 'p', name: '安心動物醫院', rel: '主治醫院', phone: '02', primary: false });
    expect(primaryVetPhone(s, 'p')?.name).toBe('安心動物醫院');
    s.vets.p = { name: 'A 醫院', doctor: '', phone: '03', addr: '', hours: '' };
    expect(primaryVetPhone(s, 'p')?.phone).toBe('03');
  });
});

test('safe file names', () => {
  expect(safeFileName('豆豆/麻糬-健康報告')).toBe('豆豆-麻糬-健康報告');
  expect(safeFileName('  ')).toBe('petpal');
});
