// Pure health logic used by the health tools (unit-tested in __tests__/health.test.ts).
import type { Med, PetKind } from './types';
import { addDays, parseYmd } from './date';
import { doseKey } from './domain';

// ---------------- Red flags ----------------

/** Signs that need a vet now. */
const RED_FLAGS = [
  '抽搐', '痙攣', '呼吸困難', '呼吸急促', '喘不過氣', '無法呼吸', '不能呼吸', '張口呼吸',
  '無法排尿', '尿不出', '一直蹲貓砂', '大量出血', '出血不止', '出血', '吐血', '血便',
  '乾嘔', '吐不出來', '牙齦發白', '牙齦發紫', '後腳癱瘓', '流口水不止',
  '巧克力', '葡萄', '木糖醇', '百合', '老鼠藥', '蟑螂藥', '洋蔥', '普拿疼', '乙醯胺酚', '布洛芬',
  '誤食', '吞異物', '吞下異物', '吞了異物', '吞了東西', '車禍', '骨折', '昏倒', '昏迷', '叫不醒',
  '腹部腫脹', '肚子脹', '中暑', '持續嘔吐',
];
/** Only these words negate a sign — 「不停」「不斷」「不知道」 are not negations. */
const NEGATIONS = ['沒有', '沒', '無', '未'];
const CLAUSE_BREAK = /[，。；、,.;!！?？\n]/;

/** False when this occurrence of `term` is really a different word (葡萄糖, 葡萄柚, 葡萄籽). */
function realMatch(term: string, text: string, i: number): boolean {
  if (term === '葡萄') {
    const next = text[i + term.length] ?? '';
    if (/[糖柚籽]/.test(next)) return false;
  }
  return true;
}

function negated(text: string, i: number): boolean {
  let start = i;
  // Stay inside the clause, look at most 2 characters back.
  while (start > 0 && i - start < 2 && !CLAUSE_BREAK.test(text[start - 1])) start--;
  const before = text.slice(start, i);
  return NEGATIONS.some((n) => before.endsWith(n) || before.includes(n));
}

export interface Assessment {
  /** Go to a vet now. */
  flags: string[];
  /** Serious; see a vet today (species-dependent). */
  warnings: string[];
}

/**
 * Read a symptom description. Each mention is checked on its own: a negated mention (「沒有抽搐」) is skipped,
 * and when a longer sign covers a shorter one (「大量出血」 vs 「出血」) only the longer one counts.
 */
export function assessSymptoms(text: string, species?: PetKind): Assessment {
  type Hit = { term: string; start: number; end: number; neg: boolean };
  const found: Hit[] = [];
  for (const term of RED_FLAGS) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(term, from);
      if (i < 0) break;
      if (realMatch(term, text, i)) found.push({ term, start: i, end: i + term.length, neg: negated(text, i) });
      from = i + 1;
    }
  }
  found.sort((a, b) => b.term.length - a.term.length || a.start - b.start);
  const taken: Hit[] = [];
  for (const h of found) {
    if (taken.some((t) => h.start >= t.start && h.end <= t.end)) continue; // inside a longer (or same) mention
    taken.push(h);
  }
  const flags = new Set(taken.filter((h) => !h.neg).map((h) => h.term));

  // 頻尿 alone is common; it is an emergency for male cats (urethral blockage).
  if (/頻尿/.test(text) && /公貓/.test(text) && !negated(text, text.indexOf('頻尿'))) flags.add('公貓頻尿');

  const warnings: string[] = [];
  const noIntake = /不吃不喝/.test(text) && !negated(text, text.indexOf('不吃不喝'));
  if (noIntake) {
    if (species === 'rabbit') flags.add('不吃不喝（兔子腸胃停滯）');
    else warnings.push('不吃不喝');
  }
  return { flags: [...flags], warnings };
}

export function findRedFlags(text: string, species?: PetKind): string[] {
  return assessSymptoms(text, species).flags;
}

/** Calm message when no red flag was found, adjusted for animals that can't wait. */
export function reassurance(species: PetKind | undefined, birthday: string, warnings: string[]): string {
  const young = birthday ? (Date.now() - parseYmd(birthday).getTime()) / 864e5 < 180 : false;
  if (warnings.length) return `${warnings.join('、')}：今天就要聯絡獸醫，不要等到明天。`;
  if (species === 'rabbit' || species === 'bird' || young) {
    const who = species === 'rabbit' ? '兔子' : species === 'bird' ? '鳥' : '幼犬幼貓';
    return `沒有發現明顯的緊急警訊。但${who}病情變化快，建議當天就醫，不要等 24 小時。`;
  }
  return '沒有發現明顯的緊急警訊。若症狀持續超過 24 小時、精神變差或不吃不喝，請盡快就醫。';
}

// ---------------- Chocolate ----------------

/** Approximate theobromine, mg per gram. When unsure, assume the strongest. */
export const CHOCOLATES = [
  { k: 'white', label: '白巧克力', mg: 0.01 },
  { k: 'milk', label: '牛奶巧克力', mg: 2.0 },
  { k: 'dark', label: '黑巧克力（70–85%）', mg: 9 },
  { k: 'cocoa', label: '烘焙用可可、可可粉', mg: 26 },
  { k: 'unknown', label: '不確定種類', mg: 26 },
] as const;
export type ChocolateKind = (typeof CHOCOLATES)[number]['k'];

export interface ChocolateResult {
  mgPerKg: number;
  tier: 0 | 1 | 2 | 3;
  text: string;
  kind: 'warn' | 'danger';
  severity: 'mild' | 'moderate' | 'severe';
}

export function chocolateRisk(kind: ChocolateKind, grams: number, weightKg: number, species: PetKind): ChocolateResult | null {
  const c = CHOCOLATES.find((x) => x.k === kind);
  if (!c || !(grams > 0) || !(weightKg > 0)) return null;
  const mgPerKg = (grams * c.mg) / weightKg;
  if (species === 'cat') {
    return { mgPerKg, tier: mgPerKg < 20 ? 1 : mgPerKg < 40 ? 2 : 3, text: '貓對可可鹼更敏感，任何份量都請立即聯絡獸醫。', kind: 'danger', severity: mgPerKg < 20 ? 'moderate' : 'severe' };
  }
  if (mgPerKg < 20) return { mgPerKg, tier: 0, text: '通常症狀輕微（嘔吐、腹瀉），仍建議致電獸醫確認，並觀察 24 小時。', kind: 'warn', severity: 'mild' };
  if (mgPerKg < 40) return { mgPerKg, tier: 1, text: '中度：可能出現躁動、心跳加快，請盡快就醫。', kind: 'danger', severity: 'moderate' };
  if (mgPerKg < 60) return { mgPerKg, tier: 2, text: '嚴重：有心律不整風險，請立即就醫。', kind: 'danger', severity: 'severe' };
  return { mgPerKg, tier: 3, text: '非常危險：可能抽搐甚至致命，請立即前往急診。', kind: 'danger', severity: 'severe' };
}

// ---------------- Medication courses ----------------

export interface MedDraft {
  meds: Med[];
  doses: Record<string, 'taken' | 'skip'>;
}

export function freqText(m: Pick<Med, 'freq' | 'start'>): string {
  if (m.freq === 'weekly') return `每週一次（星期${'日一二三四五六'[parseYmd(m.start).getDay()]}）`;
  if (m.freq === 'monthly') return `每月一次（${parseYmd(m.start).getDate()} 日）`;
  return '每天';
}

/** Delete dose records of a course from `from` on (and optionally only for `times`), giving back pill counts. */
function dropDoses(d: MedDraft, medId: string, from: string, keepTimes?: string[], moveTo?: string) {
  const med = d.meds.find((m) => m.id === medId);
  const target = moveTo ? d.meds.find((m) => m.id === moveTo) : undefined;
  for (const k of Object.keys(d.doses)) {
    const [day, id, t] = k.split('|');
    if (id !== medId || day < from) continue;
    if (moveTo && keepTimes?.includes(t) && target) {
      d.doses[doseKey(day, moveTo, t)] = d.doses[k];
      delete d.doses[k];
      continue;
    }
    if (!moveTo && keepTimes?.includes(t)) continue;
    if (d.doses[k] === 'taken') {
      const owner = target ?? med;
      if (owner && owner.count !== null && owner.count !== undefined) owner.count += 1;
    }
    delete d.doses[k];
  }
}

/**
 * Save edits to an existing course without rewriting history.
 * - Daily courses that started before today and change schedule (times/dose/frequency) are split:
 *   the old course ends yesterday, a new one starts today (or the later start the user picked).
 * - Weekly/monthly courses keep their start date (it is the dosing anchor); they are edited in place.
 * - Today's records for times that no longer exist are removed and their pills given back.
 * - A course shortened to before today loses today's records (pills given back).
 * Returns the id of the course that now carries the schedule.
 */
export function applyMedEdit(d: MedDraft, medId: string, next: Omit<Med, 'id'>, td: string, newId: string): string {
  const old = d.meds.find((m) => m.id === medId);
  if (!old) return medId;
  const scheduleChanged = old.dose !== next.dose || old.freq !== next.freq || old.times.join() !== next.times.join();
  const yesterday = addDays(td, -1);

  if (next.end && next.end < td) {
    Object.assign(old, next);
    dropDoses(d, medId, td);
    return medId;
  }

  if (scheduleChanged && old.freq === 'daily' && next.freq === 'daily' && old.start < td) {
    const start = next.start > td ? next.start : td;
    old.end = old.end && old.end < yesterday ? old.end : yesterday;
    d.meds.push({ ...next, id: newId, start });
    dropDoses(d, medId, td, next.times, newId);
    return newId;
  }

  // Weekly/monthly (anchor kept unless the user changed it), or not started yet, or only name/notify changed.
  const start = old.freq !== 'daily' && next.freq === old.freq && next.start === old.start ? old.start : next.start;
  Object.assign(old, { ...next, start });
  dropDoses(d, medId, td, next.times);
  return medId;
}

/** Stop a course from today: it ends yesterday; a course starting today or later is removed. Pills from today's records are given back. */
export function stopMed(d: MedDraft, medId: string, td: string): 'stopped' | 'removed' {
  const m = d.meds.find((x) => x.id === medId);
  if (!m) return 'removed';
  dropDoses(d, medId, td);
  if (m.start >= td) {
    d.meds = d.meds.filter((x) => x.id !== medId);
    return 'removed';
  }
  m.end = addDays(td, -1);
  return 'stopped';
}
