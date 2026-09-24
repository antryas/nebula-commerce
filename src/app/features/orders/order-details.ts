import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { OrdersApi } from '../../core/api/orders-api';
import { toApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ApiError, Order, OrderStatus } from '../../models';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState } from '../../shared/ui/empty-state';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { PageHeader } from '../../shared/ui/page-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { STATUS_META, StatusChip } from '../../shared/ui/status-chip';
import { Stagger } from '../../shared/directives/stagger';
import { PAYMENT_META, buildTimeline, flagEmoji, itemCount, statusTargets } from './order-format';
import { OrderTimeline } from './order-timeline';
import { NbCurrencyPipe, NbDatePipe } from '../../shared/pipes/intl-format';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; order: Order }
  | { kind: 'not-found' }
  | { kind: 'error'; error: ApiError };

/** Single order: items, totals, customer, shipping, payment and status timeline. */
@Component({
  selector: 'nb-order-details-page',
  imports: [
    Avatar,
    NbCurrencyPipe,
    NbDatePipe,
    EmptyState,
    ErrorState,
    GlassCard,
    MatMenuModule,
    OrderTimeline,
    PageHeader,
    RouterLink,
    Skeleton,
    Stagger,
    StatusChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-details.html',
  styleUrl: './order-details.scss',
})
export class OrderDetails {
  private readonly api = inject(OrdersApi);
  private readonly toasts = inject(ToastService);

  /** Route param bound via `withComponentInputBinding()`. */
  readonly id = input<string>();

  private readonly retryTick = signal(0);
  private readonly state = signal<LoadState>({ kind: 'loading' });
  protected readonly updating = signal(false);

  protected readonly view = this.state.asReadonly();
  protected readonly order = computed(() => {
    const s = this.state();
    return s.kind === 'ready' ? s.order : null;
  });
  protected readonly loadError = computed(() => {
    const s = this.state();
    return s.kind === 'error' ? s.error : null;
  });
  protected readonly timeline = computed(() => {
    const o = this.order();
    return o ? buildTimeline(o) : [];
  });
  protected readonly targets = computed(() => {
    const o = this.order();
    return o ? statusTargets(o.status) : [];
  });
  protected readonly flag = computed(() =>
    flagEmoji(this.order()?.shippingAddress.countryCode ?? ''),
  );
  protected readonly units = computed(() => {
    const o = this.order();
    return o ? itemCount(o) : 0;
  });

  protected readonly meta = STATUS_META;
  protected readonly payment = PAYMENT_META;

  constructor() {
    combineLatest([toObservable(this.id), toObservable(this.retryTick)])
      .pipe(
        switchMap(([id]) =>
          id
            ? this.api.get(id).pipe(
                map((order): LoadState => ({ kind: 'ready', order })),
                catchError((e: unknown) => {
                  const error = toApiError(e);
                  return of<LoadState>(
                    error.status === 404 ? { kind: 'not-found' } : { kind: 'error', error },
                  );
                }),
                startWith<LoadState>({ kind: 'loading' }),
              )
            : of<LoadState>({ kind: 'not-found' }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.state.set(s));
  }

  protected retry(): void {
    this.retryTick.update((n) => n + 1);
  }

  protected async changeStatus(status: OrderStatus): Promise<void> {
    const order = this.order();
    if (!order || this.updating()) return;
    this.updating.set(true);
    try {
      const updated = await firstValueFrom(this.api.updateStatus(order.id, status));
      this.state.set({ kind: 'ready', order: updated });
      this.toasts.success(
        `Order #${updated.number} updated`,
        `Marked as ${STATUS_META[status].label.toLowerCase()}`,
      );
    } catch {
      // Surfaced as a toast by the error interceptor.
    } finally {
      this.updating.set(false);
    }
  }
}
