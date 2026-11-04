import { addDays, addMonths, daysBetween, ageText, isValidYmd, addMonthKey, ymd, parseYmd } from '../date';

describe('date helpers', () => {
  test('addDays crosses month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  test('addMonths clamps to the last day of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-10-15', 12)).toBe('2027-10-15');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
  });

  test('daysBetween counts calendar days', () => {
    expect(daysBetween('2026-11-01', '2026-11-01')).toBe(0);
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7);
    expect(daysBetween('2026-11-08', '2026-11-01')).toBe(-7);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });

  test('month keys', () => {
    expect(addMonthKey('2026-12', 1)).toBe('2027-01');
    expect(addMonthKey('2026-01', -1)).toBe('2025-12');
  });

  test('validation and round trip', () => {
    expect(isValidYmd('2026-02-29')).toBe(false);
    expect(isValidYmd('2028-02-29')).toBe(true);
    expect(isValidYmd('2026/11/01')).toBe(false);
    expect(ymd(parseYmd('2026-11-02'))).toBe('2026-11-02');
  });

  test('ageText', () => {
    expect(ageText('')).toBe('');
    const d = new Date();
    const twoYearsAgo = `${d.getFullYear() - 2}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d.getDate(), 28)).padStart(2, '0')}`;
    expect(ageText(twoYearsAgo)).toMatch(/^2 歲/);
  });
});

describe('greeting', () => {
  test('uses Taiwan-natural wording by time of day', () => {
    const { greeting } = require('../date');
    expect(greeting(8)).toBe('早安');
    expect(greeting(12)).toBe('午安');
    expect(greeting(15)).toBe('下午好');
    expect(greeting(19)).toBe('晚上好');
    expect(greeting(23)).toBe('晚安');
    expect(greeting(2)).toBe('夜深了');
  });
});
