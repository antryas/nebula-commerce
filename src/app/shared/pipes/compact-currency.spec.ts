import { CompactCurrencyPipe } from './compact-currency';

describe('CompactCurrencyPipe', () => {
  const p = new CompactCurrencyPipe();

  it.each([
    [950, '$950'],
    [1234, '$1.2K'],
    [48210, '$48.2K'],
    [1250000, '$1.3M'],
  ])('%d → %s', (v, out) => expect(p.transform(v)).toBe(out));

  it('returns an empty string for null and undefined', () => {
    expect(p.transform(null)).toBe('');
    expect(p.transform(undefined)).toBe('');
  });
});
