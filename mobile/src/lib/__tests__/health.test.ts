import { findRedFlags, assessSymptoms, chocolateRisk, applyMedEdit, stopMed, freqText } from '../health';
import type { MedDraft } from '../health';
import type { Med } from '../types';
import { addDays } from '../date';
import { doseKey } from '../domain';

describe('red flags', () => {
  test('negated mentions are ignored', () => {
    expect(findRedFlags('沒有抽搐，有點吐')).toEqual([]);
    expect(findRedFlags('沒吃巧克力')).toEqual([]);
  });
  test('不停 / 不斷 / 不知道 are not negations', () => {
    expect(findRedFlags('不停抽搐')).toEqual(['抽搐']);
    expect(findRedFlags('不斷吐血')).toEqual(['吐血']);
    expect(findRedFlags('不知道有沒有吃巧克力')).toEqual(['巧克力']);
  });
  test('negation does not cross a clause break', () => {
    expect(findRedFlags('吃不下，呼吸急促')).toEqual(['呼吸急促']);
    expect(findRedFlags('沒有吐，呼吸急促')).toEqual(['呼吸急促']);
  });
  test('negating a long sign also silences the shorter one inside it', () => {
    expect(findRedFlags('沒有大量出血')).toEqual([]);
    expect(findRedFlags('出血不止')).toEqual(['出血不止']);
  });
  test('words that only look like a sign', () => {
    expect(findRedFlags('喝了葡萄糖水')).toEqual([]);
    expect(findRedFlags('吃了葡萄柚')).toEqual([]);
    expect(findRedFlags('吃了三顆葡萄')).toEqual(['葡萄']);
    expect(findRedFlags('吞下藥丸')).toEqual([]);
    expect(findRedFlags('頻尿')).toEqual([]);
  });
  test('male cat urinary signs are flagged', () => {
    expect(findRedFlags('公貓尿不出來').length).toBeGreaterThan(0);
    expect(findRedFlags('公貓一直頻尿')).toContain('公貓頻尿');
  });
  test('not eating or drinking: emergency for rabbits, warning for others', () => {
    expect(assessSymptoms('不吃不喝', 'rabbit').flags.length).toBe(1);
    const dog = assessSymptoms('不吃不喝', 'dog');
    expect(dog.flags).toEqual([]);
    expect(dog.warnings).toEqual(['不吃不喝']);
  });
});

describe('chocolate', () => {
  test('dark chocolate uses 9 mg/g', () => {
    const r = chocolateRisk('dark', 50, 10, 'dog')!;
    expect(Math.round(r.mgPerKg)).toBe(45);
    expect(r.tier).toBe(2);
  });
  test('small amounts still advise calling the vet', () => {
    const r = chocolateRisk('milk', 20, 10, 'dog')!;
    expect(r.tier).toBe(0);
    expect(r.text).toContain('致電獸醫');
  });
  test('unknown type assumes cocoa powder', () => {
    expect(chocolateRisk('unknown', 10, 10, 'dog')!.mgPerKg).toBe(26);
  });
  test('cats always get the urgent message', () => {
    expect(chocolateRisk('milk', 1, 4, 'cat')!.text).toContain('立即聯絡獸醫');
  });
  test('missing input gives null', () => {
    expect(chocolateRisk('milk', 0, 10, 'dog')).toBeNull();
  });
});

describe('medication edits', () => {
  const td = '2026-11-15';
  const med = (over: Partial<Med>): Med => ({
    id: 'm', petId: 'p', name: '藥', dose: '1 顆', times: ['08:00'], start: '2026-10-01', end: null, notify: true, freq: 'daily', count: 10, refillAt: 2, ...over,
  });

  test('weekly course keeps its start (dosing anchor) when the time changes', () => {
    const d: MedDraft = { meds: [med({ freq: 'weekly' })], doses: {} };
    const id = applyMedEdit(d, 'm', { ...med({ freq: 'weekly' }), times: ['09:00'] }, td, 'new');
    expect(id).toBe('m');
    expect(d.meds).toHaveLength(1);
    expect(d.meds[0].start).toBe('2026-10-01');
    expect(d.meds[0].times).toEqual(['09:00']);
  });

  test('daily course that started earlier is split; today\'s matching record moves over', () => {
    const d: MedDraft = { meds: [med({ times: ['08:00', '20:00'] })], doses: { [doseKey(td, 'm', '08:00')]: 'taken', [doseKey(td, 'm', '20:00')]: 'taken' } };
    applyMedEdit(d, 'm', { ...med({}), times: ['08:00'], count: 8 }, td, 'n');
    expect(d.meds.find((m) => m.id === 'm')!.end).toBe(addDays(td, -1));
    const n = d.meds.find((m) => m.id === 'n')!;
    expect(n.start).toBe(td);
    expect(d.doses[doseKey(td, 'n', '08:00')]).toBe('taken');
    expect(d.doses[doseKey(td, 'm', '20:00')]).toBeUndefined();
    expect(n.count).toBe(9); // the removed 20:00 pill is given back
  });

  test('stopping gives back today\'s pills', () => {
    const d: MedDraft = { meds: [med({})], doses: { [doseKey(td, 'm', '08:00')]: 'taken', [doseKey(addDays(td, -1), 'm', '08:00')]: 'taken' } };
    expect(stopMed(d, 'm', td)).toBe('stopped');
    expect(d.meds[0].end).toBe(addDays(td, -1));
    expect(d.meds[0].count).toBe(11);
    expect(d.doses[doseKey(addDays(td, -1), 'm', '08:00')]).toBe('taken');
  });

  test('a course starting today is removed when stopped', () => {
    const d: MedDraft = { meds: [med({ start: td })], doses: {} };
    expect(stopMed(d, 'm', td)).toBe('removed');
    expect(d.meds).toHaveLength(0);
  });

  test('frequency text', () => {
    expect(freqText({ freq: 'monthly', start: '2026-10-15' })).toBe('每月一次（15 日）');
    expect(freqText({ freq: 'daily', start: '2026-10-15' })).toBe('每天');
  });
});
