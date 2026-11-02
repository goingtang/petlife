import { chooseCopy } from '../persist';
import { migrate } from '../store';

const d = (savedAt: number, tag: string) => ({ _savedAt: savedAt, tag });

describe('chooseCopy (which saved copy to load)', () => {
  test('normal case: main is newest', () => {
    const r = chooseCopy([
      { name: 'main', exists: true, data: d(3, 'main') },
      { name: 'tmp', exists: false, data: null },
      { name: 'bak', exists: true, data: d(2, 'bak') },
    ]);
    expect(r.data.tag).toBe('main');
    expect(r.source).toBe('main');
  });

  test('killed after writing .tmp but before replacing main: the newer .tmp wins', () => {
    const r = chooseCopy([
      { name: 'main', exists: true, data: d(3, 'main') },
      { name: 'tmp', exists: true, data: d(4, 'tmp') },
      { name: 'bak', exists: true, data: d(2, 'bak') },
    ]);
    expect(r.data.tag).toBe('tmp');
  });

  test('half-written .tmp (unreadable) is ignored', () => {
    const r = chooseCopy([
      { name: 'main', exists: true, data: d(3, 'main') },
      { name: 'tmp', exists: true, data: null },
      { name: 'bak', exists: true, data: d(2, 'bak') },
    ]);
    expect(r.data.tag).toBe('main');
  });

  test('unreadable main falls back to the newest other copy and is reported', () => {
    const r = chooseCopy([
      { name: 'main', exists: true, data: null },
      { name: 'tmp', exists: false, data: null },
      { name: 'bak', exists: true, data: d(2, 'bak') },
    ]);
    expect(r.data.tag).toBe('bak');
    expect(r.mainUnreadable).toBe(true);
  });

  test('first-version files without _savedAt still load (main preferred)', () => {
    const r = chooseCopy([
      { name: 'main', exists: true, data: { tag: 'main' } },
      { name: 'tmp', exists: false, data: null },
      { name: 'bak', exists: true, data: { tag: 'bak' } },
    ]);
    expect(r.data.tag).toBe('main');
  });

  test('no files at all → nothing (caller may try the old AsyncStorage key)', () => {
    const r = chooseCopy([
      { name: 'main', exists: false, data: null },
      { name: 'tmp', exists: false, data: null },
      { name: 'bak', exists: false, data: null },
    ]);
    expect(r.data).toBeNull();
    expect(r.anyFile).toBe(false);
  });
});

describe('migrate with damaged nested data', () => {
  test('recurring, vets, entries and pets are repaired instead of crashing', () => {
    const s = migrate({
      members: [{ id: 'me', name: '我', color: '#000' }],
      recurring: [{ id: 'r', amt: '650', day: 40 }, null, 'x'],
      vets: { p: { name: 'A' }, q: null },
      entries: [{ id: 'e', petId: 'p', form: 'growth', at: '2026-11-01T09:00' }, null],
      pets: [{ id: 'p' }, { name: 'no id' }],
      erVet: 'nope',
    });
    expect(s.recurring).toHaveLength(1);
    expect(s.recurring[0].day).toBe(28);
    expect(s.recurring[0].amt).toBe(650);
    expect(s.recurring[0].lastPosted).toMatch(/^\d{4}-\d{2}$/);
    expect(s.vets.p.phone).toBe('');
    expect(s.vets.q).toBeUndefined();
    expect(s.entries).toHaveLength(1);
    expect(s.entries[0].v).toEqual({});
    expect(s.pets).toHaveLength(1);
    expect(s.pets[0].name).toBe('寵物');
    expect(s.erVet).toBeNull();
  });
});
