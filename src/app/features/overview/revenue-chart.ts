import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { NgxEchartsDirective } from 'ngx-echarts';
import { AnalyticsApi } from '../../core/api/analytics-api';
import { RevenueRange, TimePoint } from '../../models';
import { injectChartPalette, revenueAreaOption } from '../../shared/charts/chart-theme';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { Skeleton } from '../../shared/ui/skeleton';
import { resourceError } from './resource-error';
import { NbCurrencyPipe, NbDecimalPipe } from '../../shared/pipes/intl-format';

interface RangeSeries {
  range: RevenueRange;
  points: TimePoint[];
}

const RANGES: { value: RevenueRange; label: string; caption: string }[] = [
  { value: '7d', label: '7D', caption: 'last 7 days' },
  { value: '30d', label: '30D', caption: 'last 30 days' },
  { value: '90d', label: '90D', caption: 'last 90 days' },
  { value: '12m', label: '12M', caption: 'last 12 months' },
];

/** Revenue trend with a range switcher; orders render as faint bars behind the line. */
@Component({
  selector: 'nb-revenue-chart',
  imports: [
    NbCurrencyPipe,
    NbDecimalPipe,
    ErrorState,
    GlassCard,
    MatButtonToggleModule,
    NgxEchartsDirective,
    Skeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-glass-card class="nb-card">
      <header class="nb-card__head">
        <div class="min-w-0">
          <h2 class="nb-card__title">Revenue</h2>
          <p class="nb-card__sub">
            @if (summary(); as s) {
              <span class="nb-rev__total">{{
                s.revenue | currency: 'USD' : 'symbol' : '1.0-0'
              }}</span>
              · {{ s.orders | number }} orders · {{ caption() }}
            } @else {
              {{ caption() }}
            }
          </p>
        </div>
        <mat-button-toggle-group
          class="nb-range"
          hideSingleSelectionIndicator
          aria-label="Revenue range"
          [value]="range()"
          (change)="range.set($event.value)"
        >
          @for (r of ranges; track r.value) {
            <mat-button-toggle [value]="r.value" [attr.aria-label]="r.caption">
              {{ r.label }}
            </mat-button-toggle>
          }
        </mat-button-toggle-group>
      </header>

      @if (error(); as e) {
        <nb-error-state title="Couldn't load revenue" [error]="e" (retry)="points.reload()" />
      } @else if (shown()) {
        <div
          echarts
          class="nb-chart nb-rev__chart"
          [class.nb-chart--busy]="points.isLoading()"
          [options]="options()"
          role="img"
          [attr.aria-label]="ariaLabel()"
        ></div>
      } @else {
        <nb-skeleton
          class="nb-rev__chart justify-end"
          [rows]="6"
          [height]="28"
          label="Loading revenue"
        />
      }
    </nb-glass-card>
  `,
  styleUrl: './overview-card.scss',
  styles: `
    .nb-rev__total {
      font-weight: 600;
      color: var(--nb-text);
    }
    .nb-rev__chart {
      height: 300px;
    }
    @media (max-width: 639px) {
      .nb-rev__chart {
        height: 240px;
      }
    }
    .nb-range {
      --mat-button-toggle-height: 2rem;
      --mat-button-toggle-shape: 0.75rem;
      --mat-button-toggle-label-text-size: 0.75rem;
      --mat-button-toggle-label-text-weight: 600;
      --mat-button-toggle-label-text-tracking: 0.02em;
      --mat-button-toggle-text-color: var(--nb-muted);
      --mat-button-toggle-background-color: transparent;
      --mat-button-toggle-state-layer-color: var(--nb-text);
      --mat-button-toggle-divider-color: var(--nb-border);
      --mat-button-toggle-selected-state-text-color: #fff;
      --mat-button-toggle-selected-state-background-color: var(--nb-accent-1);
      flex: none;
      background: color-mix(in srgb, var(--nb-card) 70%, transparent);
    }
    .nb-range ::ng-deep .mat-button-toggle-checked {
      background: linear-gradient(135deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 6px 18px -8px var(--nb-accent-1);
    }
    .nb-range ::ng-deep .mat-button-toggle-label-content {
      padding: 0 0.75rem;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class RevenueChart {
  private readonly api = inject(AnalyticsApi);
  private readonly palette = injectChartPalette();

  protected readonly ranges = RANGES;
  protected readonly range = signal<RevenueRange>('30d');
  protected readonly caption = computed(
    () => RANGES.find((r) => r.value === this.range())?.caption ?? '',
  );

  protected readonly points = rxResource({
    params: () => this.range(),
    stream: ({ params }) =>
      this.api.revenue(params).pipe(map((points): RangeSeries => ({ range: params, points }))),
  });
  protected readonly error = resourceError(this.points);

  /** Keeps the previous series (and chart instance) on screen while a new range loads. */
  protected readonly shown = linkedSignal<RangeSeries | undefined, RangeSeries | undefined>({
    source: () => (this.points.hasValue() ? this.points.value() : undefined),
    computation: (next, prev) => next ?? prev?.value,
  });

  protected readonly options = computed(() => {
    const s = this.shown();
    return revenueAreaOption(s?.points ?? [], this.palette(), s?.range);
  });
  protected readonly summary = computed(() => {
    const pts = this.shown()?.points;
    if (!pts) return null;
    return {
      revenue: pts.reduce((s, p) => s + p.revenue, 0),
      orders: pts.reduce((s, p) => s + p.orders, 0),
    };
  });
  protected readonly ariaLabel = computed(() => {
    const s = this.summary();
    const total = s ? `$${Math.round(s.revenue).toLocaleString('en-US')}` : '';
    return `Revenue chart, ${this.caption()}${total ? `: ${total} total` : ''}`;
  });
}
