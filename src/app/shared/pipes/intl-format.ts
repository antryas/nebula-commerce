import { Pipe, PipeTransform } from '@angular/core';

/*
 * Drop-in `currency`, `number` and `date` pipes built on `Intl` (en-US). They cover the
 * argument subset this app uses with Angular's own syntax, so templates read the same.
 *
 * Why not `@angular/common`'s pipes: they bring Angular's locale-data formatting engine
 * (~20 kB). esbuild places a shared framework file in the initial bundle as soon as any
 * lazy chunk uses it, so a pipe in one page inflated the first load for every page.
 */

const LOCALE = 'en-US';
const formatters = new Map<string, Intl.NumberFormat>();

/** Parses Angular's `digitsInfo` (`{minInt}.{minFrac}-{maxFrac}`), e.g. `1.0-1`. */
function digits(info: string | undefined, fallbackMin: number, fallbackMax: number) {
  const match = /^(\d+)?\.?(\d+)?-?(\d+)?$/.exec(info ?? '');
  const minInt = Number(match?.[1] ?? 1);
  const minFrac = Number(match?.[2] ?? fallbackMin);
  const maxFrac = Math.max(minFrac, Number(match?.[3] ?? Math.max(minFrac, fallbackMax)));
  return {
    minimumIntegerDigits: minInt,
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  };
}

function numberFormat(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, options);
    formatters.set(key, format);
  }
  return format;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(n) ? null : n;
}

/** `{{ total | currency: 'USD' }}` → `$1,234.50`; `currency: 'USD' : 'symbol' : '1.0-0'` → `$1,235`. */
@Pipe({ name: 'currency' })
export class NbCurrencyPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    currencyCode = 'USD',
    _display?: 'symbol',
    digitsInfo?: string,
  ): string | null {
    const n = toNumber(value);
    if (n === null) return null;
    const key = `c|${currencyCode}|${digitsInfo ?? ''}`;
    const options: Intl.NumberFormatOptions = digitsInfo
      ? digits(digitsInfo, 2, 2)
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return numberFormat(key, { style: 'currency', currency: currencyCode, ...options }).format(n);
  }
}

/** `{{ n | number }}` → `1,234.568` (max 3 decimals); `number: '1.1-1'` → `12.5`. */
@Pipe({ name: 'number' })
export class NbDecimalPipe implements PipeTransform {
  transform(value: number | string | null | undefined, digitsInfo?: string): string | null {
    const n = toNumber(value);
    if (n === null) return null;
    return numberFormat(`n|${digitsInfo ?? ''}`, digits(digitsInfo, 0, 3)).format(n);
  }
}

const MONTHS_LONG = new Intl.DateTimeFormat(LOCALE, { month: 'long' });
const MONTHS_SHORT = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Tokens of Angular's date format syntax that this app uses; other text is literal. */
const DATE_TOKENS: Record<string, (d: Date) => string> = {
  MMMM: (d) => MONTHS_LONG.format(d),
  MMM: (d) => MONTHS_SHORT.format(d),
  MM: (d) => pad2(d.getMonth() + 1),
  dd: (d) => pad2(d.getDate()),
  d: (d) => String(d.getDate()),
  y: (d) => String(d.getFullYear()),
  hh: (d) => pad2(d.getHours() % 12 || 12),
  h: (d) => String(d.getHours() % 12 || 12),
  HH: (d) => pad2(d.getHours()),
  mm: (d) => pad2(d.getMinutes()),
  a: (d) => (d.getHours() < 12 ? 'AM' : 'PM'),
};
const DATE_TOKEN_RE = /MMMM|MMM|MM|dd|d|y|hh|h|HH|mm|a/g;

/** `{{ iso | date: 'MMM d, y · h:mm a' }}` → `Sep 24, 2026 · 5:36 PM` (local time). */
@Pipe({ name: 'date' })
export class NbDatePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined, format = 'MMM d, y'): string | null {
    if (value == null || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return format.replace(DATE_TOKEN_RE, (token) => DATE_TOKENS[token](date));
  }
}
