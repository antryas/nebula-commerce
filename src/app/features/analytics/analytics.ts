import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';
import { AnalyticsApi } from '../../core/api/analytics-api';
import { toApiError } from '../../core/http/api-error';
import { ThemeService } from '../../core/theme/theme.service';
import { ApiError, RevenueRange } from '../../models';
import { injectChartPalette } from '../../shared/charts/chart-theme';
import { CompactCurrencyPipe } from '../../shared/pipes/compact-currency';
import { Stagger } from '../../shared/directives/stagger';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { PageHeader } from '../../shared/ui/page-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { CountryFlag } from '../customers/country-flag';
import { funnelOption, geoOption, heatmapOption, revenueOption } from './analytics-options';
import { loadWorldMap } from './world-map';
import { NbCurrencyPipe, NbDecimalPipe } from '../../shared/pipes/intl-format';

export const ANALYTICS_RANGES: readonly { value: RevenueRange; label: string }[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '12m', label: '12 months' },
];

const TOP_COUNTRIES = 8;

/** Resource errors arrive wrapped when the thrown value is not an `Error` (e.g. `ApiError`). */
function apiErrorOf(e: Error | undefined): ApiError | null {
  return e ? toApiError((e as { cause?: unknown }).cause ?? e) : null;
}

@Component({
  selector: 'nb-analytics-page',
  imports: [
    CompactCurrencyPipe,
    CountryFlag,
    NbCurrencyPipe,
    NbDecimalPipe,
    ErrorState,
    GlassCard,
    NgxEchartsDirective,
    PageHeader,
    Skeleton,
    Stagger,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
})
export class Analytics {
  private readonly api = inject(AnalyticsApi);
  private readonly theme = inject(ThemeService);
  private readonly doc = inject(DOCUMENT);

  protected readonly ranges = ANALYTICS_RANGES;
  protected readonly range = signal<RevenueRange>('30d');

  protected readonly revenue = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.api.revenue(params),
  });
  protected readonly heatmap = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.api.heatmap(params),
  });
  protected readonly geo = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.api.geo(params),
  });
  protected readonly funnel = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.api.funnel(params),
  });

  protected readonly mapReady = signal(false);
  protected readonly mapFailed = signal(false);

  private readonly palette = injectChartPalette();

  protected readonly revenueChart = computed(() =>
    this.chart(
      this.revenue.hasValue() ? revenueOption(this.revenue.value(), this.palette()) : null,
    ),
  );
  protected readonly heatmapChart = computed(() =>
    this.chart(
      this.heatmap.hasValue() ? heatmapOption(this.heatmap.value(), this.palette()) : null,
    ),
  );
  protected readonly geoChart = computed(() =>
    this.chart(
      this.geo.hasValue() && this.mapReady() ? geoOption(this.geo.value(), this.palette()) : null,
    ),
  );
  protected readonly funnelChart = computed(() =>
    this.chart(this.funnel.hasValue() ? funnelOption(this.funnel.value(), this.palette()) : null),
  );

  protected readonly revenueError = computed(() => apiErrorOf(this.revenue.error()));
  protected readonly heatmapError = computed(() => apiErrorOf(this.heatmap.error()));
  protected readonly geoError = computed(() => apiErrorOf(this.geo.error()));
  protected readonly funnelError = computed(() => apiErrorOf(this.funnel.error()));

  protected readonly totals = computed(() => {
    const points = this.revenue.hasValue() ? this.revenue.value() : [];
    const revenue = points.reduce((sum, p) => sum + p.revenue, 0);
    const orders = points.reduce((sum, p) => sum + p.orders, 0);
    return { revenue, orders, aov: orders ? revenue / orders : 0 };
  });

  protected readonly peak = computed(() => {
    const cells = this.heatmap.hasValue() ? this.heatmap.value() : [];
    const top = cells.reduce<(typeof cells)[number] | null>(
      (best, c) => (!best || c.orders > best.orders ? c : best),
      null,
    );
    if (!top || top.orders === 0) return null;
    const day = [
      'Mondays',
      'Tuesdays',
      'Wednesdays',
      'Thursdays',
      'Fridays',
      'Saturdays',
      'Sundays',
    ];
    return `${day[top.weekday]} at ${String(top.hour).padStart(2, '0')}:00`;
  });

  protected readonly conversion = computed(() => {
    const steps = this.funnel.hasValue() ? this.funnel.value() : [];
    const first = steps[0]?.value ?? 0;
    const last = steps.at(-1)?.value ?? 0;
    return first ? (last / first) * 100 : 0;
  });

  protected readonly countries = computed(() => {
    const rows = this.geo.hasValue() ? this.geo.value() : [];
    const total = rows.reduce((sum, r) => sum + r.revenue, 0) || 1;
    const max = rows[0]?.revenue || 1;
    return rows.slice(0, TOP_COUNTRIES).map((r) => ({
      ...r,
      share: (r.revenue / total) * 100,
      bar: (r.revenue / max) * 100,
    }));
  });

  constructor() {
    this.loadMap();
  }

  protected setRange(range: RevenueRange): void {
    this.range.set(range);
  }

  protected loadMap(): void {
    this.mapFailed.set(false);
    loadWorldMap(this.doc.baseURI).then(
      () => this.mapReady.set(true),
      () => this.mapFailed.set(true),
    );
  }

  /** Disables chart animation for users who prefer reduced motion. */
  private chart(option: EChartsOption | null): EChartsOption | null {
    if (!option) return null;
    return this.theme.reducedMotion() ? { ...option, animation: false } : option;
  }
}
