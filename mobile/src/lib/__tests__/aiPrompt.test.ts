import { buildAiPrompt, scrubPrivate } from '../aiPrompt';
import { sampleStore } from '../seed';

describe('AI prompt', () => {
  const store = sampleStore();
  const pet = store.pets[0];
  const td = new Date().toISOString().slice(0, 10);

  test('does not claim to be a triage or diagnosis service', () => {
    const p = buildAiPrompt(store, pet, '嘔吐', [], td);
    expect(p).not.toContain('分診');
    expect(p).toContain('不是診斷');
  });

  test('never includes phone numbers, addresses or photo paths', () => {
    const p = buildAiPrompt(store, pet, '吐了，醫院電話 02-2700-1234，我的手機 0912 345 678 https://x.example/a.jpg', [], td);
    expect(p).not.toMatch(/2700-1234|0912|345 678|https?:/);
    for (const v of Object.values(store.vets)) {
      if (v.phone) expect(p).not.toContain(v.phone);
      if (v.addr) expect(p).not.toContain(v.addr);
    }
    for (const c of store.contacts) if (c.phone) expect(p).not.toContain(c.phone);
    expect(p).not.toMatch(/file:|\.jpe?g/);
  });

  test('scrubPrivate keeps normal numbers like weights and counts', () => {
    expect(scrubPrivate('吐了 2 次，體重 10.8 kg')).toBe('吐了 2 次，體重 10.8 kg');
  });
});
