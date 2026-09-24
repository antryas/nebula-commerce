import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { OrdersApi } from '../../core/api/orders-api';
import { toApiError } from '../../core/http/api-error';
import { LiveOrdersService } from '../../core/live/live-orders.service';
import { ToastService } from '../../core/notifications/toast.service';
import { ApiError, Order } from '../../models';

/** Board columns, in pipeline order. */
export const FULFILLMENT_STATUSES = ['new', 'packing', 'shipped', 'delivered'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];
export type FulfillmentColumns = Record<FulfillmentStatus, Order[]>;

const DELIVERED_LIMIT = 20;
const OPEN_LIMIT = 100;
/** How long a freshly arrived live order keeps its highlight. */
export const FRESH_MS = 2400;

/** The status after `status` in the pipeline, or `null` at the end. */
export function nextStatus(status: FulfillmentStatus): FulfillmentStatus | null {
  return FULFILLMENT_STATUSES[FULFILLMENT_STATUSES.indexOf(status) + 1] ?? null;
}

function rank(status: FulfillmentStatus): number {
  return FULFILLMENT_STATUSES.indexOf(status);
}

function emptyColumns(): FulfillmentColumns {
  return { new: [], packing: [], shipped: [], delivered: [] };
}

function isBoardStatus(status: string): status is FulfillmentStatus {
  return (FULFILLMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * State of the fulfillment kanban. Moves are optimistic: the card jumps immediately, the
 * PATCH runs in the background and only that card is put back if the server refuses.
 */
@Injectable()
export class FulfillmentStore {
  private readonly api = inject(OrdersApi);
  private readonly toasts = inject(ToastService);
  private readonly live = inject(LiveOrdersService);

  private readonly _columns = signal<FulfillmentColumns>(emptyColumns());
  private readonly _loading = signal(true);
  private readonly _error = signal<ApiError | null>(null);
  private readonly _pending = signal<ReadonlySet<string>>(new Set());
  private readonly _fresh = signal<ReadonlySet<string>>(new Set());
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private loaded = false;

  readonly columns = this._columns.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  /** Orders whose move is waiting for the server. */
  readonly pending = this._pending.asReadonly();
  /** Live orders that just arrived (highlighted for a moment). */
  readonly fresh = this._fresh.asReadonly();

  readonly totals = computed(() => {
    const cols = this._columns();
    const sums = {} as Record<FulfillmentStatus, number>;
    for (const s of FULFILLMENT_STATUSES) sums[s] = cols[s].reduce((sum, o) => sum + o.total, 0);
    return sums;
  });

  constructor() {
    // The order that was already "latest" before the board opened is loaded with the list.
    const seen = untracked(this.live.latest)?.id;
    effect(() => {
      const order = this.live.latest();
      if (order && order.id !== seen) untracked(() => this.addLive(order));
    });
    inject(DestroyRef).onDestroy(() => this.timers.forEach((t) => clearTimeout(t)));
    this.load();
  }

  load(): void {
    this._loading.set(true);
    this._error.set(null);
    forkJoin([
      this.api.list({ status: ['new', 'packing', 'shipped'], page: 1, pageSize: OPEN_LIMIT }),
      this.api.list({
        status: ['delivered'],
        page: 1,
        pageSize: DELIVERED_LIMIT,
        sort: 'createdAt',
        dir: 'desc',
      }),
    ]).subscribe({
      next: ([open, delivered]) => {
        const cols = emptyColumns();
        for (const o of open.items) if (isBoardStatus(o.status)) cols[o.status].push(o);
        cols.delivered = delivered.items;
        this._columns.set(cols);
        this.loaded = true;
        this._loading.set(false);
      },
      error: (e: unknown) => {
        this._error.set(toApiError(e));
        this._loading.set(false);
      },
    });
  }

  /** Moves the order one step forward (keyboard alternative to dragging). */
  advance(orderId: string): Promise<void> {
    const found = this.locate(orderId);
    const to = found && nextStatus(found.status);
    return to ? this.move(orderId, to, 0) : Promise.resolve();
  }

  async move(orderId: string, to: FulfillmentStatus, index: number): Promise<void> {
    const found = this.locate(orderId);
    if (!found || this._pending().has(orderId)) return;
    const { status: from, index: fromIndex, order } = found;

    if (from === to) {
      this._columns.update((cols) => ({
        ...cols,
        [to]: insertAt(without(cols[to], orderId), order, index),
      }));
      return;
    }
    if (rank(to) < rank(from)) {
      this.toasts.error('Orders can only move forward');
      return;
    }

    this._columns.update((cols) => ({
      ...cols,
      [from]: without(cols[from], orderId),
      [to]: insertAt(cols[to], { ...order, status: to }, index),
    }));
    this.setPending(orderId, true);

    try {
      const saved = await firstValueFrom(this.api.updateStatus(orderId, to, { silent: true }));
      this._columns.update((cols) => ({
        ...cols,
        [to]: cols[to].map((o) => (o.id === orderId ? saved : o)),
      }));
    } catch (e: unknown) {
      this._columns.update((cols) => ({
        ...cols,
        [to]: without(cols[to], orderId),
        [from]: insertAt(without(cols[from], orderId), order, fromIndex),
      }));
      this.toasts.error(`Could not move order #${order.number}`, toApiError(e).message);
    } finally {
      this.setPending(orderId, false);
    }
  }

  private locate(orderId: string) {
    const cols = this._columns();
    for (const status of FULFILLMENT_STATUSES) {
      const index = cols[status].findIndex((o) => o.id === orderId);
      if (index >= 0) return { status, index, order: cols[status][index] };
    }
    return null;
  }

  private addLive(order: Order): void {
    if (!this.loaded || order.status !== 'new' || this.locate(order.id)) return;
    this._columns.update((cols) => ({ ...cols, new: [order, ...cols.new] }));
    this._fresh.update((set) => new Set(set).add(order.id));
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this._fresh.update((set) => {
        const next = new Set(set);
        next.delete(order.id);
        return next;
      });
    }, FRESH_MS);
    this.timers.add(timer);
  }

  private setPending(id: string, on: boolean): void {
    this._pending.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}

function without(list: Order[], id: string): Order[] {
  return list.filter((o) => o.id !== id);
}

function insertAt(list: Order[], order: Order, index: number): Order[] {
  const at = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, at), order, ...list.slice(at)];
}
