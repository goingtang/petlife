import { cleanNumberText, parseTypedNumber } from '../numparse';

describe('parseTypedNumber', () => {
  it('parses decimals with dot or comma', () => {
    expect(parseTypedNumber('5.2', { decimals: 1 })).toEqual({ kind: 'ok', value: 5.2, outOfRange: null });
    expect(parseTypedNumber('5,2', { decimals: 1 })).toEqual({ kind: 'ok', value: 5.2, outOfRange: null });
  });
  it('treats empty as empty and a trailing dot as the integer part', () => {
    expect(parseTypedNumber('', { decimals: 1 })).toEqual({ kind: 'empty' });
    expect(parseTypedNumber('5.', { decimals: 1 })).toEqual({ kind: 'ok', value: 5, outOfRange: null });
    expect(parseTypedNumber('.', { decimals: 1 })).toEqual({ kind: 'partial' });
  });
  it('rejects malformed input', () => {
    expect(parseTypedNumber('1.2.3', { decimals: 1 }).kind).toBe('invalid');
    expect(parseTypedNumber('1.5', { decimals: 0 }).kind).toBe('invalid');
  });
  it('rounds to the allowed decimals', () => {
    expect(parseTypedNumber('5.26', { decimals: 1 })).toEqual({ kind: 'ok', value: 5.3, outOfRange: null });
  });
  it('flags out-of-range values instead of clamping', () => {
    expect(parseTypedNumber('500', { decimals: 1, min: 0.1, max: 200 })).toEqual({ kind: 'ok', value: 500, outOfRange: 'high' });
    expect(parseTypedNumber('0', { decimals: 1, min: 0.1, max: 200 })).toEqual({ kind: 'ok', value: 0, outOfRange: 'low' });
  });
  it('cleans typed text', () => {
    expect(cleanNumberText('5.2 kg', 1)).toBe('5.2');
    expect(cleanNumberText('12a', 0)).toBe('12');
  });
});
