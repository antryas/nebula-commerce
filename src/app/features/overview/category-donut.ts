import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NgxEchartsDirective } from 'ngx-echarts';
import { AnalyticsApi } from '../../core/api/analytics-api';
import { donutOption, injectChartPalette } from '../../shared/charts/chart-theme';
import { CompactCurrencyPipe } from '../../shared/pipes/compact-currency';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { Skeleton } from '../../shared/ui/skeleton';
import { resourceError } from './resource-error';

/** Revenue split by product category (last 30 days) as a rounded donut with a legend. */
@Component({
  selector: 'nb-category-donut',
  imports: [CompactCurrencyPipe, DecimalPipe, ErrorState, GlassCard, NgxEchartsDirective, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-glass-card class="nb-card">
      <header class="nb-card__head">
        <div>
          <h2 class="nb-card__title">Sales by category</h2>
          <p class="nb-card__sub">Last 30 days</p>
        </div>
      </header>

      @if (error(); as e) {
        <nb-error-state title="Couldn't load categories" [error]="e" (retry)="sales.reload()" />
      } @else if (sales.hasValue()) {
        <div
          echarts
          class="nb-chart nb-donut__chart"
          [options]="options()"
          role="img"
          [attr.aria-label]="ariaLabel()"
        ></div>
        <ul class="nb-legend">
          @for (row of legend(); track row.name) {
            <li>
              <span class="nb-legend__dot" [style.color]="row.color" aria-hidden="true"></span>
              <span class="nb-legend__name">{{ row.name }}</span>
              <span class="nb-legend__value">{{ row.revenue | compactCurrency }}</span>
              <span class="nb-legend__pct">{{ row.pct | number: '1.0-0' }}%</span>
            </li>
          }
        </ul>
      } @else {
        <div class="nb-donut__placeholder" aria-hidden="true">
          <span class="nb-donut__ring nb-shimmer"></span>
        </div>
        <nb-skeleton [rows]="3" [height]="14" label="Loading categories" />
      }
    </nb-glass-card>
  `,
  styleUrl: './overview-card.scss',
  styles: `
    .nb-card {
      container-type: inline-size;
    }
    .nb-donut__chart,
    .nb-donut__placeholder {
      height: 220px;
    }
    .nb-donut__placeholder {
      display: grid;
      place-items: center;
    }
    .nb-donut__ring {
      width: 176px;
      height: 176px;
      border-radius: 9999px;
      -webkit-mask: radial-gradient(circle, transparent 58%, #000 59%);
      mask: radial-gradient(circle, transparent 58%, #000 59%);
    }
    .nb-legend {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .nb-legend li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      font-size: 0.8125rem;
    }
    .nb-legend__dot {
      flex: none;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: currentColor;
      box-shadow: 0 0 10px currentColor;
    }
    .nb-legend__name {
      overflow: hidden;
      color: var(--nb-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nb-legend__value {
      margin-left: auto;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--nb-text);
    }
    .nb-legend__pct {
      width: 2.25rem;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--nb-muted);
    }
    @container (max-width: 360px) {
      .nb-legend__pct {
        display: none;
      }
    }
  `,
})
export class CategoryDonut {
  private readonly api = inject(AnalyticsApi);
  private readonly palette = injectChartPalette();

  protected readonly sales = rxResource({ stream: () => this.api.categories('30d') });
  protected readonly error = resourceError(this.sales);

  private readonly data = computed(() => (this.sales.hasValue() ? this.sales.value() : []));
  protected readonly options = computed(() => donutOption(this.data(), this.palette()));
  protected readonly legend = computed(() => {
    const rows = this.data();
    const total = rows.reduce((s, r) => s + r.revenue, 0) || 1;
    const colors = this.palette().series;
    return rows.map((r, i) => ({
      name: r.category,
      revenue: r.revenue,
      pct: (r.revenue / total) * 100,
      color: colors[i % colors.length],
    }));
  });
  protected readonly ariaLabel = computed(
    () =>
      'Sales by category: ' +
      this.legend()
        .map((r) => `${r.name} ${Math.round(r.pct)}%`)
        .join(', '),
  );
}
