import {
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  inject,
  input,
  numberAttribute,
  untracked,
} from '@angular/core';
import { ThemeService } from '../../core/theme/theme.service';

export type KpiFormat = 'currency' | 'number' | 'percent';

const CURRENCY_WHOLE = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const CURRENCY_CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Formats a KPI value: currency `$48,210` (cents only below $1,000), number `1,284`,
 * percent `3.4%` (the value is already a percentage).
 */
export function formatKpi(value: number, format: KpiFormat): string {
  switch (format) {
    case 'currency':
      return Math.abs(value) >= 1000 ? CURRENCY_WHOLE.format(value) : CURRENCY_CENTS.format(value);
    case 'percent':
      return `${ONE_DECIMAL.format(value)}%`;
    default:
      return WHOLE.format(value);
  }
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animates the host's text from the previous value (0 initially) to `nbCountUp` with an
 * ease-out curve. Under reduced motion the final value is written immediately.
 */
@Directive({ selector: '[nbCountUp]' })
export class CountUp {
  readonly nbCountUp = input.required({ transform: numberAttribute });
  readonly format = input<KpiFormat>('number');
  readonly durationMs = input(900, { transform: numberAttribute });

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly theme = inject(ThemeService);
  private current = 0;
  private frame: number | null = null;

  constructor() {
    effect(() => {
      const target = this.nbCountUp();
      const format = this.format();
      const duration = this.durationMs();
      const instant = this.theme.reducedMotion();
      untracked(() => this.animate(target, format, duration, instant));
    });
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  private animate(target: number, format: KpiFormat, duration: number, instant: boolean): void {
    this.cancel();
    const from = this.current;
    if (
      instant ||
      duration <= 0 ||
      from === target ||
      typeof requestAnimationFrame !== 'function'
    ) {
      this.render(target, format);
      return;
    }

    const start = performance.now();
    this.render(from, format);
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      this.render(t >= 1 ? target : from + (target - from) * easeOutCubic(t), format);
      this.frame = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.frame = requestAnimationFrame(step);
  }

  private render(value: number, format: KpiFormat): void {
    this.current = value;
    this.el.textContent = formatKpi(value, format);
  }

  private cancel(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
