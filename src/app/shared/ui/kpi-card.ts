import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { Kpi } from '../../models';
import { CountUp } from '../directives/count-up';
import { Stagger } from '../directives/stagger';
import { GlassCard } from './glass-card';
import { GradientBorder } from './gradient-border';
import { Sparkline } from './sparkline';

const KPI_ICONS: Record<Kpi['key'], string> = {
  revenue: 'payments',
  orders: 'shopping_bag',
  aov: 'receipt_long',
  conversion: 'conversion_path',
};

/** Dashboard metric tile: label, animated value, period-over-period delta and trend. */
@Component({
  selector: 'nb-kpi-card',
  imports: [CountUp, GlassCard, GradientBorder, Sparkline],
  hostDirectives: [{ directive: Stagger, inputs: ['nbStagger: index'] }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <nb-gradient-border [active]="highlight()" class="h-full">
      <nb-glass-card class="nb-kpi h-full" [class.nb-kpi--highlight]="highlight()">
        <div class="flex items-start justify-between gap-3">
          <p class="nb-kpi__label">{{ kpi().label }}</p>
          <span class="nb-kpi__icon material-symbols-rounded" aria-hidden="true">{{ icon() }}</span>
        </div>
        <p class="nb-kpi__value" [nbCountUp]="kpi().value" [format]="kpi().format"></p>
        <div class="flex items-end justify-between gap-3">
          <span
            class="nb-kpi__delta"
            [class.nb-kpi__delta--up]="up()"
            [class.nb-kpi__delta--down]="!up()"
            role="img"
            [attr.aria-label]="deltaLabel()"
          >
            <span aria-hidden="true">{{ up() ? '▲' : '▼' }}</span>
            {{ deltaText() }}
          </span>
          <nb-sparkline
            [data]="kpi().spark"
            [positive]="up()"
            [width]="96"
            [height]="32"
            [label]="kpi().label + ' trend, ' + (up() ? 'rising' : 'falling')"
          />
        </div>
      </nb-glass-card>
    </nb-gradient-border>
  `,
  styles: `
    .nb-kpi {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      overflow: hidden;
      transition:
        transform 200ms ease,
        box-shadow 200ms ease;
    }
    .nb-kpi:hover {
      transform: translateY(-2px);
    }
    .nb-kpi--highlight {
      background:
        radial-gradient(
          120% 90% at 100% 0%,
          color-mix(in srgb, var(--nb-accent-1) 22%, transparent),
          transparent 62%
        ),
        var(--nb-glass-bg);
    }
    .nb-kpi__label {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--nb-muted);
    }
    .nb-kpi__icon {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      overflow: hidden;
      border-radius: 0.625rem;
      font-size: 1.125rem;
      color: var(--nb-accent-1);
      background: color-mix(in srgb, var(--nb-accent-1) 14%, transparent);
    }
    .nb-kpi--highlight .nb-kpi__icon {
      color: #fff;
      background: linear-gradient(135deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 8px 20px -8px var(--nb-accent-1);
    }
    .nb-kpi__value {
      margin: 0;
      font-size: 1.875rem;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      color: var(--nb-text);
    }
    .nb-kpi__delta {
      --nb-delta: var(--nb-success);
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.1875rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: color-mix(in srgb, var(--nb-delta) 72%, var(--nb-text));
      background: color-mix(in srgb, var(--nb-delta) 14%, transparent);
    }
    .nb-kpi__delta--down {
      --nb-delta: var(--nb-danger);
    }
    .nb-kpi__delta > span {
      font-size: 0.625rem;
    }
  `,
})
export class KpiCard {
  readonly kpi = input.required<Kpi>();
  readonly highlight = input(false, { transform: booleanAttribute });

  protected readonly icon = computed(() => KPI_ICONS[this.kpi().key] ?? 'insights');
  protected readonly up = computed(() => this.kpi().deltaPct >= 0);
  protected readonly deltaText = computed(() => `${Math.abs(this.kpi().deltaPct).toFixed(1)}%`);
  protected readonly deltaLabel = computed(
    () => `${this.up() ? 'Up' : 'Down'} ${this.deltaText()} vs previous period`,
  );
}
