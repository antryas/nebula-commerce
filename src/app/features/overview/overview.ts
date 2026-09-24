import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AnalyticsApi } from '../../core/api/analytics-api';
import { AuthService } from '../../core/auth/auth.service';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { Kpi } from '../../models';
import { Stagger } from '../../shared/directives/stagger';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { KpiCard } from '../../shared/ui/kpi-card';
import { Skeleton } from '../../shared/ui/skeleton';
import { CategoryDonut } from './category-donut';
import { RecentOrders } from './recent-orders';
import { resourceError } from './resource-error';
import { RevenueChart } from './revenue-chart';
import { TopProducts } from './top-products';

/** Time-of-day salutation: morning 5-11, afternoon 12-17, evening otherwise. */
export function greeting(at: Date): string {
  const h = at.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** Dashboard home: KPIs, revenue trend, category split, live recent orders, best sellers. */
@Component({
  selector: 'nb-overview-page',
  imports: [
    CategoryDonut,
    ErrorState,
    GlassCard,
    KpiCard,
    RecentOrders,
    RevenueChart,
    Skeleton,
    Stagger,
    TopProducts,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="nb-hero">
      <div class="min-w-0">
        <p class="nb-hero__date">{{ today }}</p>
        <h1 class="nb-hero__title">
          {{ salutation }}, <span class="nb-gradient-text">{{ firstName() }}</span>
        </h1>
        <p class="nb-hero__sub">Here's what's happening with Nebula today.</p>
      </div>
      @if (live.enabled()) {
        <p class="nb-hero__live" role="status">
          <span class="nb-hero__pulse" aria-hidden="true"></span>
          Live
          @if (live.count(); as n) {
            <span class="nb-hero__count">+{{ n }} {{ n === 1 ? 'order' : 'orders' }}</span>
          }
        </p>
      }
    </header>

    <section
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:gap-5"
      aria-label="Key metrics"
    >
      @if (kpiError(); as e) {
        <nb-glass-card class="sm:col-span-2 xl:col-span-4" [padded]="false">
          <nb-error-state title="Couldn't load metrics" [error]="e" (retry)="kpis.reload()" />
        </nb-glass-card>
      } @else if (kpiList(); as list) {
        @for (k of list; track k.key; let i = $index) {
          <nb-kpi-card [kpi]="k" [highlight]="k.key === 'revenue'" [index]="i" />
        }
      } @else {
        @for (i of placeholders; track i) {
          <nb-glass-card class="h-[9.5rem]">
            <nb-skeleton [rows]="3" [height]="18" label="Loading metric" />
          </nb-glass-card>
        }
      }
    </section>

    <div class="mt-4 grid grid-cols-1 gap-4 lg:mt-5 lg:grid-cols-12 lg:gap-5">
      <nb-revenue-chart class="lg:col-span-8" [nbStagger]="4" />
      <nb-category-donut class="lg:col-span-4" [nbStagger]="5" />
      <nb-recent-orders class="lg:col-span-7" [nbStagger]="6" />
      <nb-top-products class="lg:col-span-5" [nbStagger]="7" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .nb-hero {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .nb-hero__date {
      margin: 0 0 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--nb-muted);
    }
    .nb-hero__title {
      margin: 0;
      font-size: clamp(1.5rem, 1.1rem + 1.6vw, 2.125rem);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.025em;
      color: var(--nb-text);
    }
    .nb-hero__sub {
      margin: 0.375rem 0 0;
      font-size: 0.875rem;
      color: var(--nb-muted);
    }
    .nb-hero__live {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      height: 2rem;
      margin: 0;
      padding: 0 0.875rem;
      border: 1px solid color-mix(in srgb, var(--nb-success) 35%, transparent);
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--nb-success) 75%, var(--nb-text));
      background: color-mix(in srgb, var(--nb-success) 10%, transparent);
    }
    .nb-hero__pulse {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: var(--nb-success);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--nb-success) 60%, transparent);
      animation: nb-hero-pulse 1.8s ease-out infinite;
    }
    @keyframes nb-hero-pulse {
      to {
        box-shadow: 0 0 0 0.5rem transparent;
      }
    }
    .nb-hero__count {
      font-variant-numeric: tabular-nums;
      text-transform: none;
      letter-spacing: 0;
      color: var(--nb-muted);
    }
  `,
})
export class Overview {
  private readonly api = inject(AnalyticsApi);
  private readonly auth = inject(AuthService);
  protected readonly live = inject(LiveOrdersService);

  protected readonly today = LONG_DATE.format(new Date());
  protected readonly salutation = greeting(new Date());
  protected readonly firstName = computed(
    () => this.auth.user()?.name.trim().split(/\s+/)[0] || 'there',
  );
  protected readonly placeholders = [0, 1, 2, 3];

  protected readonly kpis = rxResource({ stream: () => this.api.overview('30d') });
  protected readonly kpiError = resourceError(this.kpis);
  /** Holds the last KPIs during a refresh so cards stay mounted and count up from there. */
  protected readonly kpiList = linkedSignal<Kpi[] | undefined, Kpi[] | undefined>({
    source: () => (this.kpis.hasValue() ? this.kpis.value() : undefined),
    computation: (next, prev) => next ?? prev?.value,
  });

  constructor() {
    const before = untracked(this.live.latest);
    effect(() => {
      const order = this.live.latest();
      if (!order || order === before) return;
      untracked(() => this.kpis.reload());
    });
  }
}
