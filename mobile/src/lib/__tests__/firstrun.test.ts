import { backupNudge, presetsFor, suggestedReminders, validChip, weeklyPick } from '../domain';
import { emptyStore } from '../seed';
import type { Store } from '../types';

const withRecords = (n: number, at = '2026-10-01T09:00'): Store => {
  const s = emptyStore();
  for (let i = 0; i < n; i++) s.entries.push({ id: 'e' + i, petId: 'p', form: 'feed', at, who: s.me, v: {} });
  return s;
};

describe('backupNudge', () => {
  test('never backed up: only once there are 20+ records', () => {
    expect(backupNudge(withRecords(5), '2026-11-04')).toBeNull();
    expect(backupNudge(withRecords(20), '2026-11-04')).toBe('never');
  });
  test('stale only after 30 days and when something changed since', () => {
    const s = withRecords(3, '2026-09-01T09:00');
    s.lastBackupAt = '2026-09-10T10:00:00Z';
    expect(backupNudge(s, '2026-10-05')).toBeNull();
    expect(backupNudge(s, '2026-11-04')).toBeNull(); // nothing new since the backup
    s.entries.push({ id: 'new', petId: 'p', form: 'feed', at: '2026-10-20T09:00', who: s.me, v: {} });
    expect(backupNudge(s, '2026-11-04')).toBe('stale');
  });
  test('dismissing silences it for 14 days', () => {
    const s = withRecords(25);
    s.backupNudgeAt = '2026-11-01';
    expect(backupNudge(s, '2026-11-10')).toBeNull();
    expect(backupNudge(s, '2026-11-16')).toBe('never');
  });
});

test('weeklyPick stays the same Monday–Sunday and changes the next week', () => {
  const l = ['a', 'b', 'c'];
  expect(weeklyPick(l, '2026-11-02')).toBe(weeklyPick(l, '2026-11-08')); // Mon..Sun
  expect(weeklyPick(l, '2026-11-09')).not.toBe(weeklyPick(l, '2026-11-08'));
  expect(weeklyPick([], '2026-11-02')).toBeUndefined();
});

test('reminder presets follow the pet kind and carry a repeat', () => {
  const rabbit = presetsFor('rabbit').map((p) => p.title);
  expect(rabbit).not.toContain('八合一疫苗');
  expect(rabbit).not.toContain('心絲蟲預防藥');
  expect(presetsFor('dog').find((p) => p.title === '狂犬病疫苗')?.repeat).toBe('yearly');
  expect(presetsFor('cat').find((p) => p.title === '體內外驅蟲')?.repeat).toBe('monthly');
  expect(suggestedReminders('cat').map((r) => r.title)).toEqual(['狂犬病疫苗', '三合一疫苗', '體內外驅蟲']);
  expect(suggestedReminders('bird').map((r) => r.title)).toEqual(['年度健康檢查']);
});

test('chip numbers are 15 digits or empty', () => {
  expect(validChip('')).toBe(true);
  expect(validChip('900123456789012')).toBe(true);
  expect(validChip('90012345678901')).toBe(false);
  expect(validChip('90012345678901a')).toBe(false);
});
