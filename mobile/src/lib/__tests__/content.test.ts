import { CONTENT } from '../../data/content';
import { EXTRA_TOXIC } from '../../data/content-health';

const all = [...(CONTENT.toxic as { id: string; cat: string; lv: number[]; name: string }[]), ...EXTRA_TOXIC];

describe('toxic content integrity', () => {
  test('every item has 4 levels between 0 and 3', () => {
    for (const t of all) {
      expect(t.lv).toHaveLength(4);
      for (const v of t.lv) expect([0, 1, 2, 3]).toContain(v);
    }
  });
  test('ids are unique', () => {
    const ids = all.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('foods listed because they are toxic never show 「少量可」', () => {
    for (const id of ['garlic', 'xylitol', 'macadamia', 'grape', 'onion', 'chocolate']) {
      const t = all.find((x) => x.id === id);
      if (t) expect(t.lv.includes(1)).toBe(false);
    }
  });
  test('garlic is at least as dangerous as onion for dogs', () => {
    const g = all.find((x) => x.id === 'garlic')!;
    const o = all.find((x) => x.id === 'onion')!;
    expect(g.lv[0]).toBeGreaterThanOrEqual(o.lv[0]);
  });
});
