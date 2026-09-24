import { NbCurrencyPipe, NbDatePipe, NbDecimalPipe } from './intl-format';

describe('Intl format pipes', () => {
  it('formats USD like Angular’s CurrencyPipe', () => {
    const pipe = new NbCurrencyPipe();
    expect(pipe.transform(1234.5, 'USD')).toBe('$1,234.50');
    expect(pipe.transform(1234.5, 'USD', 'symbol', '1.0-0')).toBe('$1,235');
    expect(pipe.transform(-3, 'USD')).toBe('-$3.00');
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform('oops')).toBeNull();
  });

  it('formats numbers like Angular’s DecimalPipe', () => {
    const pipe = new NbDecimalPipe();
    expect(pipe.transform(1234.56789)).toBe('1,234.568');
    expect(pipe.transform(12)).toBe('12');
    expect(pipe.transform(3.14159, '1.1-1')).toBe('3.1');
    expect(pipe.transform(3, '1.1-1')).toBe('3.0');
    expect(pipe.transform(42.6, '1.0-0')).toBe('43');
    expect(pipe.transform(undefined)).toBeNull();
  });

  it('formats dates with Angular’s pattern tokens in local time', () => {
    const pipe = new NbDatePipe();
    const date = new Date(2026, 8, 4, 17, 6);
    expect(pipe.transform(date, 'MMM d, y · h:mm a')).toBe('Sep 4, 2026 · 5:06 PM');
    expect(pipe.transform(date, 'MMMM y')).toBe('September 2026');
    expect(pipe.transform(date.toISOString(), 'MMM d, y')).toBe('Sep 4, 2026');
    expect(pipe.transform(new Date(2026, 0, 2, 0, 30), 'h:mm a')).toBe('12:30 AM');
    expect(pipe.transform('not a date')).toBeNull();
  });
});
