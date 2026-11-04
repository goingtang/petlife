import {
  prevMonthKey, initialLastPosted, recurringMissedThisMonth, restockCategory, costPerDayText,
  samePlace, validCoord, chunk, mentionsGrape, phoneDigits, normalizeName, roundCoord,
} from '../life';
import { isSamplePhone, sampleStore, emptyStore } from '../seed';

describe('prevMonthKey', () => {
  it('goes back one month, across the year', () => {
    expect(prevMonthKey('2026-11')).toBe('2026-10');
    expect(prevMonthKey('2026-01')).toBe('2025-12');
  });
});

describe('recurring expenses', () => {
  it('posts this month automatically when the day has not come yet', () => {
    expect(initialLastPosted('2026-11-02', 15)).toBe('2026-10');
    expect(recurringMissedThisMonth('2026-11-02', 15)).toBe(false);
  });
  it('treats this month as done (and offers 本月也記一筆) when the day has passed or is today', () => {
    expect(initialLastPosted('2026-11-20', 15)).toBe('2026-11');
    expect(initialLastPosted('2026-11-15', 15)).toBe('2026-11');
    expect(recurringMissedThisMonth('2026-11-15', 15)).toBe(true);
  });
  it('handles January', () => {
    expect(initialLastPosted('2026-01-01', 5)).toBe('2025-12');
  });
});

describe('restockCategory', () => {
  it('food words go to 食物, everything else to 用品', () => {
    expect(restockCategory('成犬乾糧')).toBe('食物');
    expect(restockCategory('貓罐頭')).toBe('食物');
    expect(restockCategory('提摩西牧草')).toBe('食物');
    expect(restockCategory('貓砂')).toBe('用品');
    expect(restockCategory('尿布墊')).toBe('用品');
  });
});

describe('costPerDayText', () => {
  it('formats or returns null', () => {
    expect(costPerDayText(1200, 30, 1)).toBe('每天約 NT$40');
    expect(costPerDayText(100, 500, 1)).toBe('每天不到 NT$1');
    expect(costPerDayText(undefined, 30, 1)).toBeNull();
    expect(costPerDayText(100, 0, 1)).toBeNull();
    expect(costPerDayText(100, 10, 0)).toBeNull();
    expect(costPerDayText(50000, 1, 1)).toBe('每天約 NT$50,000');
  });
});

describe('places', () => {
  const a = { name: '好心動物醫院', lat: 25.033, lon: 121.5654 };
  it('same name nearby is the same place', () => {
    expect(samePlace(a, { name: '好心 動物醫院', lat: 25.0331, lon: 121.5655 })).toBe(true);
  });
  it('far away or different name is not', () => {
    expect(samePlace(a, { ...a, lat: 25.04 })).toBe(false);
    expect(samePlace(a, { ...a, name: '快樂動物醫院' })).toBe(false);
  });
  it('normalizeName drops brackets and branch suffix', () => {
    expect(normalizeName('好心動物醫院（大安分院）')).toBe(normalizeName('好心動物醫院'));
  });
  it('validCoord', () => {
    expect(validCoord('25.03', '121.56')).toBe(true);
    expect(validCoord(NaN, 121)).toBe(false);
    expect(validCoord('abc', 121)).toBe(false);
    expect(validCoord(0, 0)).toBe(false);
    expect(validCoord(95, 10)).toBe(false);
    expect(validCoord(undefined, undefined)).toBe(false);
  });
  it('phoneDigits normalises +886', () => {
    expect(phoneDigits('+886-2-2345-6789')).toBe('0223456789');
    expect(phoneDigits('(02) 2345 6789')).toBe('0223456789');
  });
});

describe('chunk', () => {
  it('splits into weeks', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7, 8, 9], 7)).toEqual([[1, 2, 3, 4, 5, 6, 7], [8, 9]]);
    expect(chunk([], 7)).toEqual([]);
  });
});

describe('mentionsGrape', () => {
  it('flags grapes and raisins', () => {
    expect(mentionsGrape('雞肉、葡萄乾、米')).toBe(true);
    expect(mentionsGrape('chicken, raisins, rice')).toBe(true);
    expect(mentionsGrape('Grapes')).toBe(true);
  });
  it('ignores glucose, grapefruit and grape seed extract', () => {
    expect(mentionsGrape('雞肉、葡萄糖、米')).toBe(false);
    expect(mentionsGrape('雞肉、葡萄柚籽萃取物')).toBe(false);
    expect(mentionsGrape('chicken, grapefruit seed extract')).toBe(false);
    expect(mentionsGrape('chicken, grape seed extract')).toBe(false);
  });
});

describe('roundCoord', () => {
  test('rounds to about 100 m', () => {
    expect(roundCoord(25.0339871)).toBe(25.034);
    expect(roundCoord(121.5644722)).toBe(121.564);
    expect(roundCoord(-33.86882)).toBe(-33.869);
  });
});

describe('isSamplePhone', () => {
  test('sample numbers are recognised in any format, real ones are not', () => {
    expect(isSamplePhone('02-0000-9999')).toBe(true);
    expect(isSamplePhone('(02) 00009999')).toBe(true);
    expect(isSamplePhone('02-2700-1234')).toBe(false);
    expect(sampleStore().erVet && isSamplePhone(sampleStore().erVet!.phone)).toBe(true);
    expect(sampleStore().sample).toBe(true);
    expect(emptyStore().sample).toBe(false);
  });
});

describe('file paths after the app folder moved', () => {
  const { rebaseUri, mapFileUris } = require('../life');
  const root = 'file:///var/mobile/Containers/Data/Application/NEW/Documents/';
  test('re-points our own files and leaves others alone', () => {
    expect(rebaseUri('file:///var/mobile/Containers/Data/Application/OLD/Documents/petpal/f_1.jpg', root)).toBe(root + 'petpal/f_1.jpg');
    expect(rebaseUri(root + 'petpal/f_1.jpg', root)).toBe(root + 'petpal/f_1.jpg');
    expect(rebaseUri('blob:http://localhost/abc', root)).toBe('blob:http://localhost/abc');
    expect(rebaseUri('content://media/external/1', root)).toBe('content://media/external/1');
  });
  test('mapFileUris reaches every place a file is stored', () => {
    const s: any = {
      pets: [{ photo: 'a' }], journal: [{ photos: ['b', 'c'] }], entries: [{ v: { docs: ['d'] } }, { v: {} }],
      docs: [{ fileUri: 'e', pages: ['f'] }], milestones: [{ photo: 'g' }], lost: { p: { photo: 'h' } }, expenses: [{ receipt: 'i' }, {}],
    };
    const seen: string[] = [];
    mapFileUris(s, (u: string) => (seen.push(u), u.toUpperCase()));
    expect(seen.sort().join('')).toBe('abcdefghi');
    expect(s.journal[0].photos).toEqual(['B', 'C']);
    expect(s.expenses[1].receipt).toBeUndefined();
  });
});
