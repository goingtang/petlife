import type { Store, Entry, Pet } from './types';
import { addDays, addMonths, today } from './date';

export const STORE_VERSION = 1;

let counter = 0;
export function uid(prefix = 'x'): string {
  counter = (counter + 1) % 1e6;
  return prefix + Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 6);
}

export const PET_COLORS = ['#F2C66D', '#EFB8A0', '#CFDCC8', '#C9D8E6', '#E2CBE6', '#E8D9B5', '#F4C7B5'];
export const MEMBER_COLORS = ['#B0532A', '#6F8F69', '#B8862A', '#6E8FB0', '#A77AA3', '#5E9C8A'];

export function emptyStore(): Store {
  return {
    v: STORE_VERSION,
    onboarded: false,
    me: 'me',
    ownerId: 'me',
    ownerPhone: '',
    erVet: null,
    members: [{ id: 'me', name: '我', color: MEMBER_COLORS[0] }],
    pets: [],
    tasks: [],
    taskDone: {},
    entries: [],
    reminders: [],
    contacts: [],
    vets: {},
    journal: [],
    meds: [],
    doses: {},
    docs: [],
    expenses: [],
    recurring: [],
    budget: 5000,
    catBudgets: {},
    supplies: [],
    groom: [],
    milestones: [],
    saved: {},
    lost: {},
    care: {},
    timer: null,
    notifyEnabled: false,
    favPlaces: [],
    scans: [],
    hideRecorder: false,
    sample: false,
    disclaimerOk: false,
    locConsent: false,
    lastBackupAt: null,
    backupNudgeAt: null,
    notifyIntroAt: null,
  };
}

/** Phone numbers used by the sample data. They are not real and must never be dialled. */
export const SAMPLE_PHONES = ['02-0000-1234', '0900-000-678', '02-0000-5678', '0900-000-111', '02-0000-9999'];
const digits = (x: string) => x.replace(/[^0-9]/g, '');
const SAMPLE_DIGITS = new Set(SAMPLE_PHONES.map(digits));
export function isSamplePhone(phone: string): boolean {
  return SAMPLE_DIGITS.has(digits(phone));
}

/** Default daily care routine for a new pet of the given kind. */
export function defaultTasks(pet: Pet, me: string) {
  const T = (title: string, time: string) => ({ id: uid('t'), petId: pet.id, title, time, who: me });
  switch (pet.kind) {
    case 'dog':
      return [T('晨間散步', '07:30'), T('早餐 · 乾糧 1 份', '08:00'), T('換新鮮的水', '12:00'), T('晚餐 · 乾糧 1 份', '18:30'), T('晚間散步', '20:00')];
    case 'cat':
      return [T('早餐 · 濕食 1 罐', '08:00'), T('鏟貓砂', '09:00'), T('換新鮮的水', '12:00'), T('逗貓 15 分鐘', '16:00'), T('晚餐 · 乾糧 1 份', '19:00')];
    case 'rabbit':
      return [T('補滿牧草', '08:00'), T('新鮮葉菜', '12:00'), T('換新鮮的水', '12:00'), T('放風 1 小時', '17:00'), T('清理便盆', '21:00')];
    default:
      return [T('早餐', '08:00'), T('換新鮮的水', '12:00'), T('晚餐', '18:30')];
  }
}

/** Suggested grooming items. `ago` is only used for sample data; real users start from today. */
export function defaultGroom(pet: Pet, sample = false) {
  const G = (name: string, every: number, ago: number) => ({ id: uid('g'), petId: pet.id, name, every, last: addDays(today(), sample ? -ago : 0), history: [] as string[] });
  switch (pet.kind) {
    case 'dog':
      return [G('洗澡', 30, 26), G('剪指甲', 21, 14), G('刷牙', 1, 1), G('清耳朵', 7, 10), G('梳毛', 3, 2)];
    case 'cat':
      return [G('梳毛', 2, 1), G('剪指甲', 14, 19), G('刷牙', 1, 2), G('清耳朵', 14, 23)];
    case 'rabbit':
      return [G('梳毛', 3, 4), G('剪指甲', 30, 34), G('牙齒檢查', 30, 23)];
    default:
      return [G('清潔', 7, 3)];
  }
}

/** Realistic sample data, dated relative to today, so every screen has something to show. */
export function sampleStore(): Store {
  const s = emptyStore();
  const td = today();
  const d = (n: number) => addDays(td, n);
  s.onboarded = true;
  s.sample = true;
  s.members = [
    { id: 'me', name: '我', color: MEMBER_COLORS[0] },
    { id: 'mom', name: '媽媽', color: MEMBER_COLORS[1] },
    { id: 'jie', name: '小傑', color: MEMBER_COLORS[2] },
  ];
  const dou: Pet = { id: 'dou', name: '豆豆', kind: 'dog', breed: '柴犬', sex: 'male', birthday: addMonths(td, -28), adopted: addMonths(td, -26), neutered: true, chip: '900 123 000 456 789', allergy: '雞肉', color: PET_COLORS[0] };
  const mochi: Pet = { id: 'mochi', name: '麻糬', kind: 'cat', breed: '米克斯', sex: 'female', birthday: addMonths(td, -14), adopted: addMonths(td, -12), neutered: true, chip: '900 123 000 812 334', allergy: '', color: PET_COLORS[1] };
  const bai: Pet = { id: 'bai', name: '小白', kind: 'rabbit', breed: '荷蘭侏儒兔', sex: 'female', birthday: addMonths(td, -8), adopted: addMonths(td, -6), neutered: false, chip: '', allergy: '', color: PET_COLORS[2] };
  s.pets = [dou, mochi, bai];

  const task = (petId: string, title: string, time: string, who: string) => ({ id: uid('t'), petId, title, time, who });
  s.tasks = [
    task('dou', '晨間散步', '07:30', 'jie'), task('dou', '早餐 · 乾糧 1 份', '08:00', 'me'), task('dou', '換新鮮的水', '12:00', 'mom'), task('dou', '晚餐 · 乾糧 1 份', '18:30', 'mom'), task('dou', '晚間散步', '20:00', 'me'),
    task('mochi', '早餐 · 濕食 1 罐', '08:00', 'me'), task('mochi', '鏟貓砂', '09:00', 'jie'), task('mochi', '換新鮮的水', '12:00', 'mom'), task('mochi', '逗貓 15 分鐘', '16:00', 'jie'), task('mochi', '晚餐 · 乾糧 1 份', '19:00', 'me'),
    task('bai', '補滿牧草', '08:00', 'mom'), task('bai', '新鮮葉菜', '12:00', 'me'), task('bai', '換新鮮的水', '12:00', 'mom'), task('bai', '放風 1 小時', '17:00', 'jie'), task('bai', '清理便盆', '21:00', 'me'),
  ];
  s.taskDone[td] = { [s.tasks[0].id]: 'jie', [s.tasks[1].id]: 'me', [s.tasks[5].id]: 'me', [s.tasks[10].id]: 'mom', [s.tasks[12].id]: 'mom' };

  const E = (petId: string, form: Entry['form'], day: number, time: string, who: string, v: any): Entry => ({ id: uid('e'), petId, form, at: `${d(day)}T${time}`, who, v });
  const growth = (petId: string, ws: number[], ls: number[]) =>
    ws.map((w, i) => E(petId, 'growth', -(ws.length - 1 - i) * 30 - 4, '09:00', 'me', { weight: w, length: ls[i], body: 'ideal' }));
  s.entries = [
    E('dou', 'feed', 0, '08:02', 'me', { food: 'dry', amount: 1, appetite: 'good' }),
    E('dou', 'activity', 0, '07:31', 'jie', { min: 25 }),
    E('dou', 'health', 0, '07:45', 'jie', { hType: 'poop', stool: 'normal' }),
    E('dou', 'activity', -1, '20:10', 'me', { min: 30 }),
    E('dou', 'health', -1, '21:10', 'mom', { hType: 'symptom', signs: ['搔癢'], severity: 'mild' }),
    E('dou', 'health', -36, '10:30', 'me', { hType: 'visit', clinic: '安心動物醫院', note: '診斷為輕微過敏性皮膚炎，外用藥膏一天兩次，連續 7 天。' }),
    ...[-2, -3, -4, -5, -6].map((n, i) => E('dou', 'activity', n, '19:30', ['me', 'jie', 'mom'][i % 3], { min: [45, 38, 50, 30, 42][i] })),
    ...growth('dou', [9.8, 10.1, 10.3, 10.2, 10.6, 10.8], [52, 53, 54, 54.5, 55, 55.5]),
    E('mochi', 'feed', 0, '08:05', 'me', { food: 'wet', amount: 1, appetite: 'good' }),
    E('mochi', 'feed', -1, '19:00', 'mom', { food: 'water', amount: 180 }),
    E('mochi', 'activity', -1, '16:20', 'jie', { min: 12 }),
    ...[-2, -3, -4, -5].map((n, i) => E('mochi', 'activity', n, '16:00', 'jie', { min: [15, 20, 10, 25][i] })),
    E('mochi', 'health', -72, '15:00', 'me', { hType: 'visit', clinic: '安心動物醫院', note: '結紮術後回診，傷口癒合良好，可拆除頭套。' }),
    ...growth('mochi', [3.1, 3.4, 3.6, 3.8, 3.9, 4.1], [38, 40, 41, 42, 43, 43.5]),
    E('bai', 'feed', 0, '08:10', 'mom', { food: 'hay', amount: 1, appetite: 'good' }),
    E('bai', 'activity', 0, '09:00', 'mom', { min: 30 }),
    ...[-1, -2, -3, -4].map((n, i) => E('bai', 'activity', n, '17:00', 'jie', { min: [60, 45, 70, 50][i] })),
    E('bai', 'health', -40, '11:00', 'me', { hType: 'visit', clinic: '森林異寵專科', note: '牙齒咬合正常，建議增加牧草量，水果每週不超過 2 次。' }),
    ...growth('bai', [0.7, 0.8, 0.85, 0.9, 0.95, 1.0], [20, 22, 23, 24, 25, 25.5]),
  ];

  const R = (petId: string, title: string, date: string, repeat: 'once' | 'monthly' | 'yearly', history: string[] = []) =>
    ({ id: uid('r'), petId, title, date, repeat, notify: true, history });
  s.reminders = [
    R('dou', '八合一疫苗', addMonths(td, 4), 'yearly', [addMonths(td, -8)]),
    R('dou', '狂犬病疫苗', d(5), 'yearly', [addMonths(d(5), -12)]),
    R('dou', '心絲蟲預防藥', d(8), 'monthly', [d(-22)]),
    R('mochi', '三合一疫苗', addMonths(td, 6), 'yearly', [addMonths(td, -6)]),
    R('mochi', '體內外驅蟲', d(-1), 'monthly'),
    R('mochi', '狂犬病疫苗', d(22), 'yearly'),
    R('bai', '剪趾甲', d(4), 'monthly'),
    R('bai', '牙齒檢查', d(42), 'once'),
  ];

  s.contacts = [
    { id: uid('c'), petId: 'dou', name: '安心動物醫院', rel: '主治醫院', phone: '02-0000-1234', primary: true },
    { id: uid('c'), petId: 'dou', name: '媽媽', rel: '家人', phone: '0900-000-678', primary: false },
    { id: uid('c'), petId: 'mochi', name: '安心動物醫院', rel: '主治醫院', phone: '02-0000-1234', primary: true },
    { id: uid('c'), petId: 'bai', name: '森林異寵專科', rel: '主治醫院', phone: '02-0000-5678', primary: true },
  ];
  s.vets = {
    dou: { name: '安心動物醫院', doctor: '王醫師', phone: '02-0000-1234', addr: '台北市大安區安和路一段 100 號（範例）', hours: '24 小時' },
    mochi: { name: '安心動物醫院', doctor: '林醫師', phone: '02-0000-1234', addr: '台北市大安區安和路一段 100 號（範例）', hours: '24 小時' },
    bai: { name: '森林異寵專科', doctor: '陳醫師', phone: '02-0000-5678', addr: '台北市大安區復興南路二段 50 號（範例）', hours: '09:00–21:00' },
  };

  const J = (petId: string, day: number, time: string, author: string, mood: string, acts: string[], title: string, body: string, priv = false) =>
    ({ id: uid('j'), petId, at: `${d(day)}T${time}`, author, mood, acts, title, body, photos: [], private: priv });
  s.journal = [
    J('dou', 0, '07:50', 'me', '開心', ['散步', '玩耍'], '早晨的公園', '今天比平常早起，豆豆在草地上滾了好幾圈，還交到一個柯基朋友。'),
    J('mochi', -2, '21:00', 'mom', '黏人', ['抱抱', '一起午睡'], '今天一直跟著我', '在家工作的時候，麻糬整天趴在鍵盤旁邊。'),
    J('bai', -3, '20:00', 'me', '平靜', ['點心'], '學會用便盆了', '連續三天都在便盆裡上廁所，獎勵一片蘋果。'),
    J('dou', -4, '18:00', 'me', '開心', ['散步'], '第一次去河堤', '一路追著蝴蝶跑，回家後秒睡。', true),
  ];

  s.meds = [
    { id: uid('m'), petId: 'dou', name: '外用藥膏', dose: '薄擦一層', times: ['08:00', '20:00'], start: d(-6), end: d(3), notify: true, freq: 'daily', count: null, refillAt: 0 },
    { id: uid('m'), petId: 'mochi', name: '益生菌', dose: '1 包', times: ['09:00'], start: d(-23), end: null, notify: true, freq: 'daily', count: 12, refillAt: 5 },
    { id: uid('m'), petId: 'dou', name: '關節保健', dose: '1 顆', times: ['18:00'], start: d(-53), end: null, notify: true, freq: 'daily', count: 25, refillAt: 7 },
    { id: uid('m'), petId: 'dou', name: '心絲蟲預防藥', dose: '1 錠', times: ['09:00'], start: addMonths(td, -3), end: null, notify: true, freq: 'monthly', count: 3, refillAt: 1 },
  ];
  for (let i = 1; i <= 6; i++) {
    const day = d(-i);
    s.doses[`${day}|${s.meds[0].id}|08:00`] = 'taken';
    s.doses[`${day}|${s.meds[0].id}|20:00`] = i === 3 ? 'skip' : 'taken';
    s.doses[`${day}|${s.meds[1].id}|09:00`] = 'taken';
    s.doses[`${day}|${s.meds[2].id}|18:00`] = i === 2 ? 'skip' : 'taken';
  }
  s.doses[`${td}|${s.meds[0].id}|08:00`] = 'taken';

  s.docs = [
    { id: uid('d'), petId: 'dou', cat: '疫苗證明', title: '狂犬病注射證明', date: addMonths(d(5), -12), exp: d(5), fileUri: null, fileName: '', mime: '', pages: [] },
    { id: uid('d'), petId: 'dou', cat: '證件', title: '寵物登記證', date: addMonths(td, -26), exp: null, fileUri: null, fileName: '', mime: '', pages: [] },
    { id: uid('d'), petId: 'dou', cat: '保險', title: '寵物保險保單', date: addMonths(td, -8), exp: addMonths(td, 4), fileUri: null, fileName: '', mime: '', pages: [] },
    { id: uid('d'), petId: 'dou', cat: '檢驗報告', title: '血液檢查報告', date: d(-36), exp: null, fileUri: null, fileName: '', mime: '', pages: [] },
  ];

  const X = (date: string, cat: string, amt: number, petId: string, note = '') => ({ id: uid('x'), date, cat, amt, petId, note });
  const base: [string, number, string, string][] = [['食物', 3200, 'all', ''], ['保險', 650, 'all', ''], ['用品', 600, 'all', '']];
  for (let m = 5; m >= 1; m--) {
    const day = addMonths(td, -m).slice(0, 8) + '15';
    base.forEach(([cat, amt, petId]) => s.expenses.push(X(day, cat, amt + ((m * 137) % 400), petId)));
    if (m % 2 === 0) s.expenses.push(X(day, '醫療', 1800 + m * 150, 'dou', '回診'));
    if (m % 3 === 0) s.expenses.push(X(day, '美容', 800, 'dou', '洗澡美容'));
  }
  s.expenses.push(X(d(-6), '食物', 1280, 'dou', '乾糧 7kg'), X(d(-4), '食物', 960, 'mochi', '主食罐 x12'), X(d(-3), '醫療', 1500, 'dou', '皮膚科'), X(d(-1), '用品', 320, 'mochi', '逗貓棒'), X(td, '食物', 450, 'bai', '牧草'), { ...X(td.slice(0, 8) + '01', '保險', 650, 'all', '寵物保險月繳'), recurringId: 'sample' });

  const SP = (petId: string, name: string, unit: string, stock: number, use: number, pack: number, price: number) => ({ id: uid('s'), petId, name, unit, stock, use, pack, asOf: td, inCart: false, price });
  s.supplies = [SP('dou', '乾糧', 'kg', 2.1, 0.18, 7, 1280), SP('mochi', '貓砂', 'kg', 3, 0.4, 10, 450), SP('bai', '牧草', 'kg', 0.6, 0.08, 1, 450), SP('dou', '尿布墊', '片', 22, 2, 50, 399), SP('dou', '潔牙骨', '支', 5, 1, 30, 520)];
  s.recurring = [{ id: uid('rc'), cat: '保險', amt: 650, petId: 'all', note: '寵物保險月繳', day: 1, lastPosted: td.slice(0, 7) }];

  s.groom = [...defaultGroom(dou, true), ...defaultGroom(mochi, true), ...defaultGroom(bai, true)];
  s.ownerPhone = '0900-000-111';
  s.erVet = { name: '星光夜間急診動物醫院（範例）', doctor: '', phone: '02-0000-9999', addr: '台北市大安區範例路 1 號', hours: '24 小時' };
  s.care = {};
  return s;
}
