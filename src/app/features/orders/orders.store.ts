import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  of,
  skip,
  switchMap,
  tap,
} from 'rxjs';
import { OrdersApi, OrdersQuery } from '../../core/api/orders-api';
import { toApiError } from '../../core/http/api-error';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ApiError, Order, OrderStatus, Paged, SortDir } from '../../models';
import { STATUS_META } from '../../shared/ui/status-chip';

export interface OrdersQueryState {
  page: number;
  pageSize: number;
  sort: string;
  dir: SortDir;
  search: string;
  status: OrderStatus[];
  /** ISO timestamp, inclusive. */
  from: string | null;
  /** ISO timestamp, inclusive. */
  to: string | null;
}

export const DEFAULT_ORDERS_QUERY: OrdersQueryState = {
  page: 1,
  pageSize: 20,
  sort: 'createdAt',
  dir: 'desc',
  search: '',
  status: [],
  from: null,
  to: null,
};

const SEARCH_DEBOUNCE_MS = 300;
const FRESH_MS = 2400;

type Outcome = { ok: Paged<Order> } | { error: ApiError };

/** Page-scoped state for the orders list: query, results, selection and live updates. */
@Injectable()
export class OrdersStore {
  private readonly api = inject(OrdersApi);
  private readonly toasts = inject(ToastService);
  private readonly live = inject(LiveOrdersService);

  private readonly _query = signal<OrdersQueryState>({ ...DEFAULT_ORDERS_QUERY });
  private readonly _result = signal<Paged<Order> | null>(null);
  private readonly _loading = signal(true);
  private readonly _error = signal<ApiError | null>(null);
  private readonly _selection = signal<ReadonlySet<string>>(new Set());
  private readonly _fresh = signal<ReadonlySet<string>>(new Set());
  private readonly _busy = signal(false);
  private readonly searchInput = signal('');
  private readonly reloadTick = signal(0);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  readonly query = this._query.asReadonly();
  readonly result = this._result.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selection = this._selection.asReadonly();
  /** True while a status mutation is in flight. */
  readonly busy = this._busy.asReadonly();
  /** Raw (not yet debounced) search text, for binding the input. */
  readonly searchText = this.searchInput.asReadonly();

  readonly items = computed(() => this._result()?.items ?? []);
  readonly total = computed(() => this._result()?.total ?? 0);
  readonly selectedCount = computed(() => this._selection().size);
  readonly allOnPageSelected = computed(() => {
    const items = this.items();
    const sel = this._selection();
    return items.length > 0 && items.every((o) => sel.has(o.id));
  });
  readonly someOnPageSelected = computed(
    () => !this.allOnPageSelected() && this.items().some((o) => this._selection().has(o.id)),
  );
  readonly hasFilters = computed(() => {
    const q = this._query();
    return !!q.search || q.status.length > 0 || !!q.from || !!q.to;
  });
  /** Default newest-first first page: the only view where live orders slide in. */
  readonly isLiveView = computed(() => {
    const q = this._query();
    return q.page === 1 && q.sort === 'createdAt' && q.dir === 'desc' && !this.hasFilters();
  });

  constructor() {
    const request = computed(() => ({ query: this._query(), tick: this.reloadTick() }));

    toObservable(request)
      .pipe(
        tap(() => {
          this._loading.set(true);
          this._error.set(null);
        }),
        switchMap(({ query }) =>
          this.api.list(toApiQuery(query)).pipe(
            map((ok): Outcome => ({ ok })),
            catchError((e: unknown) => of<Outcome>({ error: toApiError(e) })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((outcome) => {
        this._loading.set(false);
        if ('ok' in outcome) this._result.set(outcome.ok);
        else this._error.set(outcome.error);
      });

    toObservable(this.searchInput)
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((s) => s.trim()),
        distinctUntilChanged(),
        filter((s) => s !== this._query().search),
        takeUntilDestroyed(),
      )
      .subscribe((search) => this._query.update((q) => ({ ...q, search, page: 1 })));

    toObservable(this.live.latest)
      .pipe(
        skip(1),
        filter((o): o is Order => o !== null),
        takeUntilDestroyed(),
      )
      .subscribe((order) => this.acceptLive(order));

    inject(DestroyRef).onDestroy(() => this.timers.forEach((t) => clearTimeout(t)));
  }

  setSearch(search: string): void {
    this.searchInput.set(search);
  }

  setStatus(status: OrderStatus[]): void {
    this._query.update((q) => ({ ...q, status: [...status], page: 1 }));
  }

  setSort(sort: string, dir: SortDir): void {
    this._query.update((q) => ({ ...q, sort, dir, page: 1 }));
  }

  setPage(page: number, pageSize: number): void {
    this._query.update((q) =>
      pageSize !== q.pageSize ? { ...q, page: 1, pageSize } : { ...q, page, pageSize },
    );
  }

  setRange(from: string | null, to: string | null): void {
    this._query.update((q) => ({ ...q, from, to, page: 1 }));
  }

  /** Clears search, status and date filters (keeps sorting and page size). */
  resetFilters(): void {
    this.searchInput.set('');
    this._query.update((q) => ({ ...q, search: '', status: [], from: null, to: null, page: 1 }));
  }

  reload(): void {
    this.reloadTick.update((n) => n + 1);
  }

  isSelected(id: string): boolean {
    return this._selection().has(id);
  }

  isFresh(id: string): boolean {
    return this._fresh().has(id);
  }

  toggle(id: string): void {
    this._selection.update((sel) => {
      const next = new Set(sel);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  toggleAllOnPage(): void {
    const ids = this.items().map((o) => o.id);
    const selectAll = !this.allOnPageSelected();
    this._selection.update((sel) => {
      const next = new Set(sel);
      for (const id of ids) {
        if (selectAll) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  clearSelection(): void {
    this._selection.set(new Set());
  }

  /** Moves every selected order to `status`. Errors are toasted by the error interceptor. */
  async bulkUpdate(status: OrderStatus): Promise<void> {
    const ids = [...this._selection()];
    if (!ids.length) return;
    this._busy.set(true);
    try {
      const { updated } = await firstValueFrom(this.api.bulkStatus(ids, status));
      const label = STATUS_META[status].label.toLowerCase();
      this.toasts.success(
        `Updated ${updated} ${updated === 1 ? 'order' : 'orders'}`,
        skippedMessage(ids.length - updated) ?? `Marked as ${label}`,
      );
      this.clearSelection();
      this.reload();
    } catch {
      // Already surfaced as a toast by the error interceptor.
    } finally {
      this._busy.set(false);
    }
  }

  /** Changes one order's status and patches it in place. */
  async updateStatus(order: Order, status: OrderStatus): Promise<void> {
    this._busy.set(true);
    try {
      const updated = await firstValueFrom(this.api.updateStatus(order.id, status));
      this._result.update((r) =>
        r ? { ...r, items: r.items.map((o) => (o.id === updated.id ? updated : o)) } : r,
      );
      this.toasts.success(
        `Order #${updated.number} updated`,
        `Marked as ${STATUS_META[status].label.toLowerCase()}`,
      );
    } catch {
      // Already surfaced as a toast by the error interceptor.
    } finally {
      this._busy.set(false);
    }
  }

  private acceptLive(order: Order): void {
    const current = this._result();
    if (!current || this._loading() || !this.isLiveView()) return;
    if (current.items.some((o) => o.id === order.id)) return;
    this._result.set({
      ...current,
      items: [order, ...current.items].slice(0, current.pageSize),
      total: current.total + 1,
    });
    this._fresh.update((s) => new Set(s).add(order.id));
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this._fresh.update((s) => {
        const next = new Set(s);
        next.delete(order.id);
        return next;
      });
    }, FRESH_MS);
    this.timers.add(timer);
  }
}

function toApiQuery(q: OrdersQueryState): OrdersQuery {
  const out: OrdersQuery = { page: q.page, pageSize: q.pageSize, sort: q.sort, dir: q.dir };
  if (q.search) out.search = q.search;
  if (q.status.length) out.status = q.status;
  if (q.from) out.from = q.from;
  if (q.to) out.to = q.to;
  return out;
}

function skippedMessage(skipped: number): string | null {
  if (skipped <= 0) return null;
  return `${skipped} closed ${skipped === 1 ? 'order was' : 'orders were'} skipped`;
}
