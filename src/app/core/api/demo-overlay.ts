import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { Order, OrderStatus, Paged, Product } from '../../models';
import { AuthService } from '../auth/auth.service';
import { ApiConfigService } from './api-config.service';
import type { CustomerProfile } from './customers-api';
import { DemoApi } from './demo-api';

/** Set to `true` by a read-only live backend on writes it validated but did not save. */
export const DRY_RUN_HEADER = 'X-Nebula-Dry-Run';
export const DEMO_OVERLAY_STORAGE_KEY = 'nebula.demoOverlay';

/** Statuses the backend refuses to change (bulk updates skip them). */
const CLOSED: readonly OrderStatus[] = ['delivered', 'cancelled'];
/** Server versions kept in memory to tell whether a change moved an item into a filter. */
const SEEN_LIMIT = 2000;
const LOW_STOCK_MAX = 10;

/**
 * One changed entity. `before` is the server version the change started from (null when the
 * app never saw it, or for entities created in this tab).
 */
export interface OverlayEntry<T> {
  value: T;
  before: T | null;
  created?: true;
}

export interface OverlayState {
  products: Record<string, OverlayEntry<Product>>;
  orders: Record<string, OverlayEntry<Order>>;
  /** Deleted product ids with their last known server version. */
  deletedProducts: Record<string, Product | null>;
}

/**
 * The visitor's changes against a read-only live backend. Such a backend validates every
 * write and answers with the resulting entity, but saves nothing; this service keeps those
 * results for the tab (sessionStorage) and `demoOverlayInterceptor` lays them over reads.
 *
 * Only item lists and details are patched. Totals are adjusted by the items that entered or
 * left a filter, but sorting, paging and server aggregates (KPIs, analytics, customer
 * lifetime value) stay exactly as the server reports them.
 *
 * Cleared on sign-out, on switching backend, by a successful (dry-run) demo reset and by
 * `clear()` ("Discard my changes" in Settings).
 */
@Injectable({ providedIn: 'root' })
export class DemoOverlay {
  private readonly config = inject(ApiConfigService);
  private readonly auth = inject(AuthService);
  private readonly demo = inject(DemoApi);

  private readonly _state = signal<OverlayState>(readState());
  private readonly _readOnly = signal(false);
  private readonly seen = {
    products: new Map<string, Product>(),
    orders: new Map<string, Order>(),
  };
  private modeRequest: Subscription | null = null;

  /** The live backend reported read-only mode (or answered a write as a dry run). */
  readonly readOnly = this._readOnly.asReadonly();
  readonly state = this._state.asReadonly();
  /** Number of entities changed, created or deleted in this tab. */
  readonly changeCount = computed(() => {
    const s = this._state();
    return (
      Object.keys(s.products).length +
      Object.keys(s.orders).length +
      Object.keys(s.deletedProducts).length
    );
  });

  constructor() {
    // Changes belong to one signed-in live session.
    effect(() => {
      const live = this.config.mode() === 'live' && this.auth.isAuthenticated();
      untracked(() => {
        this.modeRequest?.unsubscribe();
        this.modeRequest = null;
        if (!live) {
          this._readOnly.set(false);
          this.clear();
          return;
        }
        this.modeRequest = this.demo.mode().subscribe({
          next: (m) => this._readOnly.set(m?.readOnly === true),
          // 404 from an older backend (or any failure): writable, unless a dry run says otherwise.
          error: () => undefined,
        });
      });
    });
  }

  /** "Discard my changes": the next reads show the server data again. */
  clear(): void {
    this.seen.products.clear();
    this.seen.orders.clear();
    if (this.changeCount() === 0) return;
    this.write(emptyState());
  }

  markReadOnly(): void {
    this._readOnly.set(true);
  }

  // ---- Capturing server versions and dry-run results ----

  /** Records server versions from a read, before the overlay is applied to it. */
  rememberProducts(items: readonly Product[]): void {
    remember(this.seen.products, items);
  }

  rememberOrders(items: readonly Order[]): void {
    remember(this.seen.orders, items);
  }

  /**
   * Keeps a product returned by a dry-run create or update. A read-only backend hands every
   * create the same "next" id, so a taken id gets a suffix. Returns the product as stored.
   */
  saveProduct(product: Product, opts: { created?: boolean; localId?: string } = {}): Product {
    const state = this._state();
    const deletedProducts = { ...state.deletedProducts };
    let entry: OverlayEntry<Product>;
    if (opts.localId) {
      const prev = state.products[opts.localId];
      const value: Product = {
        ...product,
        id: opts.localId,
        sold: 0,
        rating: 0,
        createdAt: prev?.value.createdAt ?? product.createdAt,
      };
      entry = { value, before: null, created: true };
    } else if (opts.created) {
      const value = { ...product, id: this.freeProductId(product.id) };
      entry = { value, before: null, created: true };
    } else {
      const prev = state.products[product.id];
      entry = {
        value: product,
        before: prev?.before ?? this.seen.products.get(product.id) ?? null,
      };
      delete deletedProducts[product.id];
    }
    this.write({
      ...state,
      products: { ...state.products, [entry.value.id]: entry },
      deletedProducts,
    });
    return entry.value;
  }

  deleteProduct(id: string): void {
    const state = this._state();
    const { [id]: prev, ...products } = state.products;
    const deletedProducts = prev?.created
      ? state.deletedProducts
      : {
          ...state.deletedProducts,
          [id]: prev?.before ?? this.seen.products.get(id) ?? null,
        };
    this.write({ ...state, products, deletedProducts });
  }

  saveOrder(order: Order): void {
    const state = this._state();
    const before = state.orders[order.id]?.before ?? this.seen.orders.get(order.id) ?? null;
    this.write({ ...state, orders: { ...state.orders, [order.id]: { value: order, before } } });
  }

  /**
   * A bulk status change answers only `{ updated }`, so the new orders are rebuilt here from
   * the versions the app already has, skipping closed orders like the backend does. Orders
   * the app never loaded in this tab cannot be rebuilt and keep their server status.
   */
  bulkStatus(ids: readonly string[], status: OrderStatus): void {
    const state = this._state();
    const orders = { ...state.orders };
    const at = new Date().toISOString();
    for (const id of ids) {
      const seen = this.seen.orders.get(id) ?? null;
      const base = orders[id]?.value ?? seen;
      if (!base || CLOSED.includes(base.status)) continue;
      orders[id] = { value: withStatus(base, status, at), before: orders[id]?.before ?? seen };
    }
    this.write({ ...state, orders });
  }

  // ---- Reading ----

  /** A product created in this tab: the backend has never heard of it. */
  localProduct(id: string): Product | null {
    const entry = this._state().products[id];
    return entry?.created ? entry.value : null;
  }

  isDeletedProduct(id: string): boolean {
    return id in this._state().deletedProducts;
  }

  applyProduct(product: Product): Product {
    return this._state().products[product.id]?.value ?? product;
  }

  applyOrder(order: Order): Order {
    return this._state().orders[order.id]?.value ?? order;
  }

  applyProducts(page: Paged<Product>, query: URLSearchParams): Paged<Product> {
    const s = this._state();
    return overlayPage(page, s.products, s.deletedProducts, productMatcher(query));
  }

  applyOrders(page: Paged<Order>, query: URLSearchParams): Paged<Order> {
    return overlayPage(page, this._state().orders, {}, orderMatcher(query));
  }

  applyCustomerProfile(profile: CustomerProfile): CustomerProfile {
    return { ...profile, orders: profile.orders.map((o) => this.applyOrder(o)) };
  }

  /** Best sellers keep the server's numbers but show the edited product. */
  applyTopProducts<T extends { product: Product }>(rows: T[]): T[] {
    return rows.map((r) => ({ ...r, product: this.applyProduct(r.product) }));
  }

  private freeProductId(id: string): string {
    const taken = this._state().products;
    if (!(id in taken)) return id;
    let n = 2;
    while (`${id}_${n}` in taken) n++;
    return `${id}_${n}`;
  }

  private write(state: OverlayState): void {
    this._state.set(state);
    try {
      if (isEmpty(state)) sessionStorage.removeItem(DEMO_OVERLAY_STORAGE_KEY);
      else sessionStorage.setItem(DEMO_OVERLAY_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable or full: the changes just won't survive a reload */
    }
  }
}

/**
 * Lays changes over one page of a list:
 * - items on the page are replaced by their changed version, deleted ones are dropped, and
 *   changed ones that no longer match the filters are dropped;
 * - page 1 also gets, in front, entities created in this tab and changed ones that moved into
 *   the filters (e.g. an order moved to "delivered" shows up under the delivered filter);
 * - `total` moves by the entities that entered or left the filters.
 * Sort order is not recomputed: prepended items sit at the top whatever the sort is.
 */
export function overlayPage<T extends { id: string }>(
  page: Paged<T>,
  entries: Record<string, OverlayEntry<T>>,
  deleted: Record<string, T | null>,
  matches: (item: T) => boolean,
): Paged<T> {
  const all = Object.values(entries);
  if (!all.length && !Object.keys(deleted).length) return page;

  const items: T[] = [];
  for (const item of page.items) {
    if (item.id in deleted) continue;
    const value = entries[item.id]?.value ?? item;
    if (value !== item && !matches(value)) continue;
    items.push(value);
  }

  const present = new Set(page.items.map((i) => i.id));
  const moved = all.filter(
    (e) =>
      !present.has(e.value.id) &&
      matches(e.value) &&
      (e.created || (e.before !== null && !matches(e.before))),
  );
  const extra = page.page === 1 ? moved.reverse().map((e) => e.value) : [];

  let delta = 0;
  for (const e of all) {
    if (e.created) delta += matches(e.value) ? 1 : 0;
    else if (e.before) delta += Number(matches(e.value)) - Number(matches(e.before));
  }
  for (const before of Object.values(deleted)) if (before && matches(before)) delta--;

  return { ...page, items: [...extra, ...items], total: Math.max(0, page.total + delta) };
}

/** The products list filters of the API (`category`, `stock`, `search`) as a predicate. */
export function productMatcher(query: URLSearchParams): (p: Product) => boolean {
  const categories = listParam(query, 'category');
  const stock = query.get('stock') ?? 'all';
  const term = searchTerm(query);
  return (p) =>
    (!categories.length || categories.includes(p.category)) &&
    matchesStock(p.stock, stock) &&
    (!term || [p.name, p.sku].some((f) => f.toLowerCase().includes(term)));
}

/** The orders list filters of the API (`status`, `from`, `to`, `search`) as a predicate. */
export function orderMatcher(query: URLSearchParams): (o: Order) => boolean {
  const statuses = listParam(query, 'status');
  const from = parseTime(query.get('from'));
  const to = parseTime(query.get('to'));
  const term = searchTerm(query);
  return (o) => {
    if (statuses.length && !statuses.includes(o.status)) return false;
    const at = Date.parse(o.createdAt);
    if ((from !== null && at < from) || (to !== null && at > to)) return false;
    return (
      !term ||
      [String(o.number), o.customerName, o.customerEmail].some((f) =>
        f.toLowerCase().includes(term),
      )
    );
  };
}

function withStatus(order: Order, status: OrderStatus, at: string): Order {
  if (order.status === status) return order;
  return { ...order, status, history: [...order.history, { status, at }] };
}

function remember<T extends { id: string }>(map: Map<string, T>, items: readonly T[]): void {
  for (const item of items) {
    map.delete(item.id);
    map.set(item.id, item);
  }
  // Maps iterate in insertion order: drop the oldest.
  for (const id of map.keys()) {
    if (map.size <= SEEN_LIMIT) break;
    map.delete(id);
  }
}

function listParam(query: URLSearchParams, name: string): string[] {
  return (query.get(name) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function searchTerm(query: URLSearchParams): string {
  return (query.get('search') ?? '').trim().toLowerCase();
}

function matchesStock(stock: number, filter: string): boolean {
  switch (filter) {
    case 'in':
      return stock > LOW_STOCK_MAX;
    case 'low':
      return stock >= 1 && stock <= LOW_STOCK_MAX;
    case 'out':
      return stock === 0;
    default:
      return true;
  }
}

function parseTime(raw: string | null): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

function emptyState(): OverlayState {
  return { products: {}, orders: {}, deletedProducts: {} };
}

function isEmpty(s: OverlayState): boolean {
  return (
    !Object.keys(s.products).length &&
    !Object.keys(s.orders).length &&
    !Object.keys(s.deletedProducts).length
  );
}

function readState(): OverlayState {
  try {
    const raw = sessionStorage.getItem(DEMO_OVERLAY_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return emptyState();
    const { products, orders, deletedProducts } = parsed as Partial<OverlayState>;
    const isRecord = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
    if (!isRecord(products) || !isRecord(orders) || !isRecord(deletedProducts)) {
      return emptyState();
    }
    return { products, orders, deletedProducts } as OverlayState;
  } catch {
    return emptyState();
  }
}
