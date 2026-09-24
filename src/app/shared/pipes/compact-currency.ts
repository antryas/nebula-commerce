import { Pipe, PipeTransform } from '@angular/core';

const COMPACT_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Short USD amounts for dense UI: `48210` → `$48.2K`, `1250000` → `$1.3M`. */
@Pipe({ name: 'compactCurrency' })
export class CompactCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value == null || Number.isNaN(value) ? '' : COMPACT_USD.format(value);
  }
}
