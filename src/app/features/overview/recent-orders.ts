import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { OrdersApi } from '../../core/api/orders-api';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { Order } from '../../models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time';
import { Avatar } from '../../shared/ui/avatar';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatusChip } from '../../shared/ui/status-chip';
import { resourceError } from './resource-error';

const LIMIT = 6;
const CLOCK_MS = 30_000;

/** Latest orders; live orders slide in at the top with a brief highlight. */
@Component({
  selector: 'nb-recent-orders',
  imports: [
    Avatar,
    CurrencyPipe,
    ErrorState,
    GlassCard,
    RelativeTimePipe,
    RouterLink,
    Skeleton,
    StatusChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-glass-card class="nb-card">
      <header class="nb-card__head">
        <div>
          <h2 class="nb-card__title">Recent orders</h2>
          <p class="nb-card__sub">
            @if (live.enabled()) {
              <span class="nb-live-dot" aria-hidden="true"></span> Updating live
            } @else {
              Latest activity
            }
          </p>
        </div>
        <a class="nb-card__link" routerLink="/orders">
          View all <span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
        </a>
      </header>

      @if (error(); as e) {
        <nb-error-state title="Couldn't load orders" [error]="e" (retry)="orders.reload()" />
      } @else if (orders.hasValue()) {
        <ul class="nb-orders" aria-label="Recent orders">
          @for (o of rows(); track o.id) {
            <li>
              <a
                class="nb-order"
                [class.nb-order--fresh]="freshIds().has(o.id)"
                [routerLink]="['/orders', o.id]"
                [attr.aria-label]="'Order ' + o.number + ' from ' + o.customerName"
              >
                <nb-avatar [src]="o.customerAvatarUrl" [name]="o.customerName" [size]="36" />
                <span class="nb-order__main">
                  <span class="nb-order__name">{{ o.customerName }}</span>
                  <span class="nb-order__meta">
                    #{{ o.number }} · {{ o.items.length }}
                    {{ o.items.length === 1 ? 'item' : 'items' }}
                  </span>
                </span>
                <nb-status-chip class="nb-order__status" [status]="o.status" />
                <span class="nb-order__side">
                  <span class="nb-order__total">{{ o.total | currency: 'USD' }}</span>
                  <span class="nb-order__time">{{ o.createdAt | relativeTime: now() }}</span>
                </span>
              </a>
            </li>
          }
        </ul>
      } @else {
        <nb-skeleton [rows]="6" [height]="36" label="Loading recent orders" />
      }
    </nb-glass-card>
  `,
  styleUrl: './overview-card.scss',
  styles: `
    .nb-live-dot {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      margin-right: 0.25rem;
      border-radius: 9999px;
      background: var(--nb-success);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--nb-success) 60%, transparent);
      animation: nb-pulse 1.8s ease-out infinite;
      vertical-align: 0.0625rem;
    }
    @keyframes nb-pulse {
      to {
        box-shadow: 0 0 0 0.5rem transparent;
      }
    }
    .nb-orders {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0 -0.5rem;
      padding: 0;
      list-style: none;
    }
    .nb-order {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      border-radius: 0.875rem;
      color: inherit;
      text-decoration: none;
      transition: background-color 150ms ease;
    }
    .nb-order:hover {
      background: color-mix(in srgb, var(--nb-text) 5%, transparent);
    }
    .nb-order:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: -2px;
    }
    .nb-order--fresh {
      animation:
        nb-order-in 480ms cubic-bezier(0.2, 0.7, 0.2, 1) both,
        nb-order-flash 2.4s ease-out both;
    }
    @keyframes nb-order-in {
      from {
        opacity: 0;
        transform: translateY(-12px);
      }
    }
    @keyframes nb-order-flash {
      0%,
      30% {
        background: color-mix(in srgb, var(--nb-accent-1) 18%, transparent);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nb-accent-1) 45%, transparent);
      }
      100% {
        background: transparent;
        box-shadow: inset 0 0 0 1px transparent;
      }
    }
    .nb-order__main {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .nb-order__name {
      overflow: hidden;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--nb-text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nb-order__meta,
    .nb-order__time {
      font-size: 0.75rem;
      color: var(--nb-muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .nb-order__side {
      display: flex;
      flex: none;
      flex-direction: column;
      align-items: flex-end;
      min-width: 5.5rem;
    }
    .nb-order__total {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--nb-text);
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 479px) {
      .nb-order__status {
        display: none;
      }
    }
  `,
})
export class RecentOrders {
  private readonly api = inject(OrdersApi);
  protected readonly live = inject(LiveOrdersService);

  protected readonly orders = rxResource({
    stream: () => this.api.list({ page: 1, pageSize: LIMIT, sort: 'createdAt', dir: 'desc' }),
  });
  protected readonly error = resourceError(this.orders);

  /** Live orders received while this card is on screen, newest first. */
  private readonly arrivals = signal<Order[]>([]);
  protected readonly freshIds = computed(() => new Set(this.arrivals().map((o) => o.id)));

  protected readonly rows = computed(() => {
    const fetched = this.orders.hasValue() ? this.orders.value().items : [];
    const seen = new Set<string>();
    return [...this.arrivals(), ...fetched]
      .filter((o) => !seen.has(o.id) && !!seen.add(o.id))
      .slice(0, LIMIT);
  });

  /** Ticks so relative timestamps ("just now", "2 min ago") stay current. */
  protected readonly now = signal(new Date());

  constructor() {
    // The order that was already "latest" before we mounted is not news.
    const before = untracked(this.live.latest);
    effect(() => {
      const order = this.live.latest();
      if (!order || order === before) return;
      untracked(() =>
        this.arrivals.update((list) =>
          [order, ...list.filter((o) => o.id !== order.id)].slice(0, LIMIT),
        ),
      );
      this.now.set(new Date());
    });

    const clock = setInterval(() => this.now.set(new Date()), CLOCK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }
}
