import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AnalyticsApi } from '../../core/api/analytics-api';
import { CompactCurrencyPipe } from '../../shared/pipes/compact-currency';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { Skeleton } from '../../shared/ui/skeleton';
import { resourceError } from './resource-error';
import { NbDecimalPipe } from '../../shared/pipes/intl-format';

/** Best sellers of the last 30 days with revenue share bars. */
@Component({
  selector: 'nb-top-products',
  imports: [CompactCurrencyPipe, NbDecimalPipe, ErrorState, GlassCard, RouterLink, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-glass-card class="nb-card">
      <header class="nb-card__head">
        <div>
          <h2 class="nb-card__title">Top products</h2>
          <p class="nb-card__sub">By revenue, last 30 days</p>
        </div>
        <a class="nb-card__link" routerLink="/products">
          All products
          <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
        </a>
      </header>

      @if (error(); as e) {
        <nb-error-state title="Couldn't load products" [error]="e" (retry)="top.reload()" />
      } @else if (top.hasValue()) {
        <ol class="nb-top">
          @for (row of rows(); track row.product.id; let i = $index) {
            <li class="nb-top__item">
              <span class="nb-top__thumb">
                <img
                  [src]="row.product.imageUrl"
                  [alt]="row.product.name"
                  width="44"
                  height="44"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                />
                <span class="nb-top__rank" aria-hidden="true">{{ i + 1 }}</span>
              </span>
              <span class="nb-top__body">
                <span class="nb-top__line">
                  <span class="nb-top__name">{{ row.product.name }}</span>
                  <span class="nb-top__revenue">{{ row.revenue | compactCurrency }}</span>
                </span>
                <span class="nb-top__line nb-top__meta">
                  <span>{{ row.product.category }}</span>
                  <span>{{ row.unitsSold | number }} sold</span>
                </span>
                <span
                  class="nb-top__bar"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-valuenow]="row.share"
                  [attr.aria-label]="row.product.name + ' revenue relative to the top seller'"
                >
                  <span
                    [style.width.%]="row.share"
                    [style.animation-delay.ms]="300 + i * 80"
                  ></span>
                </span>
              </span>
            </li>
          }
        </ol>
      } @else {
        <nb-skeleton [rows]="5" [height]="44" label="Loading top products" />
      }
    </nb-glass-card>
  `,
  styleUrl: './overview-card.scss',
  styles: `
    .nb-top {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .nb-top__item {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      min-width: 0;
    }
    .nb-top__thumb {
      position: relative;
      flex: none;
      width: 2.75rem;
      height: 2.75rem;
    }
    .nb-top__thumb img {
      width: 100%;
      height: 100%;
      border-radius: 0.75rem;
      object-fit: cover;
      background: var(--nb-card);
      box-shadow: 0 0 0 1px var(--nb-border);
    }
    .nb-top__rank {
      position: absolute;
      top: -0.375rem;
      left: -0.375rem;
      display: grid;
      place-items: center;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 9999px;
      font-size: 0.625rem;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--nb-accent-1) 85%, #000),
        color-mix(in srgb, var(--nb-accent-2) 70%, #000)
      );
      box-shadow: 0 0 0 2px var(--nb-card);
    }
    .nb-top__body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
    }
    .nb-top__line {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .nb-top__name {
      overflow: hidden;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--nb-text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nb-top__revenue {
      flex: none;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--nb-text);
      font-variant-numeric: tabular-nums;
    }
    .nb-top__meta {
      font-size: 0.75rem;
      color: var(--nb-muted);
      font-variant-numeric: tabular-nums;
    }
    .nb-top__bar {
      display: block;
      height: 0.375rem;
      margin-top: 0.25rem;
      overflow: hidden;
      border-radius: 9999px;
      background: color-mix(in srgb, var(--nb-text) 8%, transparent);
    }
    .nb-top__bar > span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 0 12px color-mix(in srgb, var(--nb-accent-1) 60%, transparent);
      transform-origin: left center;
      animation: nb-grow 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
    }
    @keyframes nb-grow {
      from {
        transform: scaleX(0);
      }
    }
  `,
})
export class TopProducts {
  private readonly api = inject(AnalyticsApi);

  protected readonly top = rxResource({ stream: () => this.api.topProducts('30d', 5) });
  protected readonly error = resourceError(this.top);

  protected readonly rows = computed(() => {
    const list = this.top.hasValue() ? this.top.value() : [];
    const max = Math.max(1, ...list.map((r) => r.revenue));
    return list.map((r) => ({ ...r, share: Math.round((r.revenue / max) * 100) }));
  });
}
