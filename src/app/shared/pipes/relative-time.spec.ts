import { RelativeTimePipe } from './relative-time';

describe('RelativeTimePipe', () => {
  const now = new Date('2026-09-24T12:00:00Z');
  const p = new RelativeTimePipe();

  it.each([
    ['2026-09-24T11:59:30Z', 'just now'],
    ['2026-09-24T11:55:00Z', '5 min ago'],
    ['2026-09-24T09:00:00Z', '3 h ago'],
    ['2026-09-22T12:00:00Z', '2 d ago'],
    ['2026-08-03T12:00:00Z', 'Aug 3'],
  ])('%s → %s', (iso, out) => expect(p.transform(iso, now)).toBe(out));

  it('accepts Date instances and treats future timestamps as just now', () => {
    expect(p.transform(new Date('2026-09-24T11:00:00Z'), now)).toBe('1 h ago');
    expect(p.transform('2026-09-24T12:05:00Z', now)).toBe('just now');
  });

  it('returns an empty string for missing or invalid input', () => {
    expect(p.transform(null, now)).toBe('');
    expect(p.transform('not-a-date', now)).toBe('');
  });
});
