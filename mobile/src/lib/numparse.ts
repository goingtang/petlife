// Parsing for numbers typed into a Stepper. Pure so it can be unit tested.

export type NumParse =
  | { kind: 'empty' }
  | { kind: 'partial' } // e.g. "5." or "," — still typing, nothing to commit yet
  | { kind: 'invalid' }
  | { kind: 'ok'; value: number; outOfRange: null | 'low' | 'high' };

/** Keep only characters that can be part of a number (comma is accepted as a decimal point). */
export function cleanNumberText(t: string, decimals: number): string {
  return decimals ? t.replace(/[^0-9.,]/g, '') : t.replace(/[^0-9]/g, '');
}

export function parseTypedNumber(text: string, opts: { decimals?: number; min?: number; max?: number } = {}): NumParse {
  const { decimals = 0, min = -Infinity, max = Infinity } = opts;
  const t = text.trim().replace(/,/g, '.');
  if (t === '') return { kind: 'empty' };
  if (t === '.' || /^\d+\.$/.test(t)) return t === '.' ? { kind: 'partial' } : ok(Number(t.slice(0, -1)));
  if (!(decimals ? /^\d*\.?\d+$/ : /^\d+$/).test(t)) return { kind: 'invalid' };
  return ok(Number(t));

  function ok(n: number): NumParse {
    if (!Number.isFinite(n)) return { kind: 'invalid' };
    const v = decimals ? Math.round(n * 10 ** decimals) / 10 ** decimals : Math.round(n);
    return { kind: 'ok', value: v, outOfRange: v < min ? 'low' : v > max ? 'high' : null };
  }
}
