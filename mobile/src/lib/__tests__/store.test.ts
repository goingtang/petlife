import { migrate, dailyMaintenance } from '../store';
import { emptyStore, sampleStore } from '../seed';
import { planNotifications, MAX_NOTES } from '../notify';
import { addDays, today, ymd } from '../date';
import { doseKey } from '../domain';

describe('migrate', () => {
  test('keeps version-1 data and fills in new fields', () => {
    const v1: any = {
      v: 1, onboarded: true, me: 'u2', members: [{ id: 'u1', name: '我', color: '#000' }, { id: 'u2', name: '媽媽', color: '#111' }],
      pets: [{ id: 'p', name: '豆豆' }],
      meds: [{ id: 'm', petId: 'p', name: '藥', dose: '', times: ['08:00'], start: '2026-01-01', end: null, notify: true }],
      docs: [{ id: 'd', petId: 'p', cat: '證件', title: '登記證', date: '2026-01-01', exp: null, fileUri: null, fileName: '', mime: '' }],
      groom: [{ id: 'g', petId: 'p', name: '洗澡', every: 30, last: '2026-10-01' }],
      lost: { p: { active: false } },
    };
    const s = migrate(v1);
    expect(s.pets[0].name).toBe('豆豆');
    expect(s.me).toBe('u2');
    expect(s.ownerId).toBe('u1');
    expect(s.meds[0].freq).toBe('daily');
    expect(s.meds[0].count).toBeNull();
    expect(s.docs[0].pages).toEqual([]);
    expect(s.groom[0].history).toEqual([]);
    expect(s.lost.p.sightings).toEqual([]);
    expect(s.recurring).toEqual([]);
    expect(s.favPlaces).toEqual([]);
  });

  test('garbage input gives an empty store instead of crashing', () => {
    expect(migrate(null).pets).toEqual([]);
    expect(migrate('x').members.length).toBe(1);
    expect(migrate({ pets: 'nope', members: [] }).pets).toEqual([]);
  });
});

describe('dailyMaintenance', () => {
  test('drops check-offs older than 60 days', () => {
    const s = emptyStore();
    s.taskDone = { '2026-01-01': { t: 'me' }, '2026-11-01': { t: 'me' } };
    dailyMaintenance(s, '2026-11-02');
    expect(Object.keys(s.taskDone)).toEqual(['2026-11-01']);
  });

  test('drops dose check-offs older than 90 days, keeps recent ones', () => {
    const s = emptyStore();
    s.doses = { '2026-07-01|m|08:00': 'taken', '2026-08-04|m|08:00': 'taken', '2026-11-01|m|08:00': 'skip' };
    dailyMaintenance(s, '2026-11-02');
    expect(Object.keys(s.doses).sort()).toEqual(['2026-08-04|m|08:00', '2026-11-01|m|08:00']);
  });

  test('posts recurring expenses once per month, including missed months', () => {
    const s = emptyStore();
    s.recurring = [{ id: 'r', cat: '保險', amt: 650, petId: 'all', note: '月繳', day: 5, lastPosted: '2026-08' }];
    dailyMaintenance(s, '2026-11-02'); // Nov 5 not reached yet
    expect(s.expenses.map((x) => x.date)).toEqual(['2026-09-05', '2026-10-05']);
    dailyMaintenance(s, '2026-11-05');
    dailyMaintenance(s, '2026-11-06');
    expect(s.expenses.map((x) => x.date)).toEqual(['2026-09-05', '2026-10-05', '2026-11-05']);
    expect(s.recurring[0].lastPosted).toBe('2026-11');
  });
});

describe('planNotifications', () => {
  const now = new Date();
  now.setHours(7, 0, 0, 0);
  const td = ymd(now);

  test('nothing when notifications are off', () => {
    expect(planNotifications(sampleStore(), now)).toEqual([]);
  });

  test('ended courses stop, logged doses are skipped, future courses start on time', () => {
    const s = emptyStore();
    s.notifyEnabled = true;
    s.pets = [{ id: 'p', name: '豆豆', kind: 'dog', breed: '', sex: 'male', birthday: '', adopted: '', neutered: false, chip: '', allergy: '', color: '#fff' }];
    s.meds = [
      { id: 'a', petId: 'p', name: '已結束', dose: '', times: ['08:00'], start: addDays(td, -10), end: addDays(td, -1), notify: true, freq: 'daily', count: null, refillAt: 0 },
      { id: 'b', petId: 'p', name: '兩天', dose: '', times: ['08:00', '20:00'], start: td, end: addDays(td, 1), notify: true, freq: 'daily', count: null, refillAt: 0 },
      { id: 'c', petId: 'p', name: '下週開始', dose: '', times: ['09:00'], start: addDays(td, 2), end: null, notify: true, freq: 'daily', count: null, refillAt: 0 },
    ];
    s.doses[doseKey(td, 'b', '08:00')] = 'taken';
    const notes = planNotifications(s, now).filter((n) => n.kind === 'med');
    const bodies = notes.map((n) => n.body);
    expect(bodies.some((b) => b.includes('已結束'))).toBe(false);
    expect(notes.filter((n) => n.body.includes('兩天')).length).toBe(3); // today 20:00 + tomorrow 08:00 & 20:00
    const firstC = notes.find((n) => n.body.includes('下週開始'));
    expect(firstC && ymd(firstC.at)).toBe(addDays(td, 2));
  });

  test('never exceeds the iOS limit and is sorted', () => {
    const s = sampleStore();
    s.notifyEnabled = true;
    for (let i = 0; i < 20; i++) s.meds.push({ ...s.meds[0], id: 'x' + i, end: null, times: ['06:00', '12:00', '18:00'] });
    const notes = planNotifications(s, now);
    expect(notes.length).toBeLessThanOrEqual(MAX_NOTES);
    for (let i = 1; i < notes.length; i++) expect(notes[i].at.getTime()).toBeGreaterThanOrEqual(notes[i - 1].at.getTime());
    expect(notes.every((n) => n.at.getTime() > now.getTime())).toBe(true);
  });

  test('medication alerts leave room for other notices', () => {
    const s = sampleStore();
    s.notifyEnabled = true;
    for (let i = 0; i < 30; i++) s.meds.push({ ...s.meds[0], id: 'y' + i, end: null, times: ['06:00', '12:00', '18:00'] });
    s.reminders.push({ id: 'far', petId: 'dou', title: '下週疫苗', date: addDays(td, 10), repeat: 'yearly', notify: true, history: [] });
    const notes = planNotifications(s, now);
    const meds = notes.filter((n) => n.kind === 'med');
    expect(meds.length).toBeLessThanOrEqual(40);
    expect(notes.some((n) => n.title.includes('下週疫苗'))).toBe(true);
    // Too many doses to fit: the last med slot asks the user to open the app.
    expect(meds[meds.length - 1].title).toContain('打開 PetPal');
  });

  test('far-off reminders never push out tomorrow\'s supply alert', () => {
    const s = emptyStore();
    s.notifyEnabled = true;
    s.pets = [{ id: 'p', name: '豆豆', kind: 'dog', breed: '', sex: 'male', birthday: '', adopted: '', neutered: false, chip: '', allergy: '', color: '#fff' }];
    for (let i = 0; i < 40; i++) s.reminders.push({ id: 'r' + i, petId: 'p', title: '提醒' + i, date: addDays(td, 30 + i), repeat: 'once', notify: true, history: [], lead: [7] });
    s.supplies = [{ id: 's', petId: 'p', name: '飼料', unit: 'g', stock: 100, use: 100, pack: 1000, asOf: td, inCart: false }];
    const notes = planNotifications(s, now);
    expect(notes.length).toBeLessThanOrEqual(MAX_NOTES);
    expect(notes.some((n) => n.kind === 'supply')).toBe(true);
  });

  test('document expiry: 30/7 days, the evening before, and one expired notice', () => {
    const s = emptyStore();
    s.notifyEnabled = true;
    s.pets = [{ id: 'p', name: '豆豆', kind: 'dog', breed: '', sex: 'male', birthday: '', adopted: '', neutered: false, chip: '', allergy: '', color: '#fff' }];
    s.reminders = [{ id: 'd', petId: 'p', title: '保單到期', date: addDays(td, 40), repeat: 'once', notify: true, history: [], lead: [30, 7, 0], docId: 'doc1' }];
    const n = planNotifications(s, now);
    expect(n.map((x) => x.title)).toEqual(['30 天後：豆豆 保單到期', '7 天後：豆豆 保單到期', '明天：豆豆 保單到期', '今天：豆豆 保單到期', '已過期：豆豆 保單到期']);
  });

  test('overdue reminders get up to 3 follow-ups', () => {
    const s = emptyStore();
    s.notifyEnabled = true;
    s.pets = [{ id: 'p', name: '豆豆', kind: 'dog', breed: '', sex: 'male', birthday: '', adopted: '', neutered: false, chip: '', allergy: '', color: '#fff' }];
    s.reminders = [{ id: 'r', petId: 'p', title: '驅蟲', date: addDays(td, -1), repeat: 'monthly', notify: true, history: [] }];
    const o = planNotifications(s, now).filter((n) => n.kind === 'overdue');
    expect(o.length).toBe(3); // today 09:00 (1 day late), plus the next two mornings
  });
});
