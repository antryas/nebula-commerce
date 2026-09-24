import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  map,
  of,
  skip,
  switchMap,
} from 'rxjs';
import { ProductInput, ProductsApi, ProductsQuery } from '../../core/api/products-api';
import { toApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ApiError, Paged, Product, ProductCategory, SortDir, StockFilter } from '../../models';

export type ProductsView = 'grid' | 'table';

export const PRODUCTS_VIEW_KEY = 'nebula.productsView';
export const SEARCH_DEBOUNCE_MS = 300;

export interface ProductsListQuery {
  page: number;
  pageSize: number;
  sort: string;
  dir: SortDir;
  search: string;
  category: ProductCategory | null;
  stock: StockFilter;
}

const INITIAL_QUERY: ProductsListQuery = {
  page: 1,
  pageSize: 12,
  sort: 'createdAt',
  dir: 'desc',
  search: '',
  category: null,
  stock: 'all',
};

type LoadResult = { ok: Paged<Product> } | { error: ApiError };

/** Products list state: query, paged result, loading/error flags and view mode. */
@Injectable()
export class ProductsStore {
  private readonly api = inject(ProductsApi);
  private readonly toast = inject(ToastService);

  private readonly _query = signal<ProductsListQuery>(INITIAL_QUERY);
  private readonly _result = signal<Paged<Product> | null>(null);
  private readonly _loading = signal(true);
  private readonly _error = signal<ApiError | null>(null);
  private readonly reloadTick = signal(0);
  private readonly searchInput = signal('');

  readonly query = this._query.asReadonly();
  readonly result = this._result.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  /** Raw search box text; the query picks it up after a debounce. */
  readonly search = this.searchInput.asReadonly();
  readonly view = signal<ProductsView>(readView());
  readonly hasFilters = computed(() => {
    const q = this._query();
    return !!q.search || q.category !== null || q.stock !== 'all';
  });

  constructor() {
    effect(() => writeView(this.view()));

    toObservable(this.searchInput)
      .pipe(skip(1), debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.patch({ search: search.trim() }));

    toObservable(computed(() => ({ q: this._query(), tick: this.reloadTick() })))
      .pipe(
        switchMap(({ q }) => {
          this._loading.set(true);
          this._error.set(null);
          return this.load(q);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this._loading.set(false);
        if ('ok' in r) this._result.set(r.ok);
        else this._error.set(r.error);
      });
  }

  setSearch(search: string): void {
    this.searchInput.set(search);
  }

  setCategory(category: ProductCategory | null): void {
    this.patch({ category });
  }

  setStock(stock: StockFilter): void {
    this.patch({ stock });
  }

  setSort(sort: string, dir: SortDir): void {
    this.patch({ sort, dir });
  }

  setPage(page: number, pageSize: number): void {
    this._query.update((q) => ({ ...q, page, pageSize }));
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.patch({ search: '', category: null, stock: 'all' });
  }

  reload(): void {
    this.reloadTick.update((n) => n + 1);
  }

  /** Deletes a product (confirmation is the caller's job), toasts and reloads the page. */
  async remove(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.toast.success('Product deleted');
    // Step back when the last item of a trailing page was removed.
    const r = this._result();
    if (r && r.items.length === 1 && r.page > 1) this.setPage(r.page - 1, r.pageSize);
    else this.reload();
  }

  /** Optimistically flips the `active` flag; rolls back when the API call fails. */
  async setActive(product: Product, active: boolean): Promise<void> {
    this.replace({ ...product, active });
    try {
      const saved = await firstValueFrom(
        this.api.update(product.id, { ...toInput(product), active }),
      );
      this.replace(saved);
    } catch {
      this.replace(product);
    }
  }

  private replace(product: Product): void {
    this._result.update((r) =>
      r ? { ...r, items: r.items.map((p) => (p.id === product.id ? product : p)) } : r,
    );
  }

  /** Filter changes always return to the first page. */
  private patch(changes: Partial<ProductsListQuery>): void {
    this._query.update((q) => ({ ...q, ...changes, page: 1 }));
  }

  private load(q: ProductsListQuery): Observable<LoadResult> {
    const params: ProductsQuery = {
      page: q.page,
      pageSize: q.pageSize,
      sort: q.sort,
      dir: q.dir,
      search: q.search,
      category: q.category ?? undefined,
      stock: q.stock,
    };
    return this.api.list(params).pipe(
      map((ok): LoadResult => ({ ok })),
      catchError((e: unknown) => of<LoadResult>({ error: toApiError(e) })),
    );
  }
}

function toInput(p: Product): ProductInput {
  return {
    sku: p.sku,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    imageUrl: p.imageUrl,
    stock: p.stock,
    variants: p.variants,
    active: p.active,
  };
}

function readView(): ProductsView {
  try {
    return localStorage.getItem(PRODUCTS_VIEW_KEY) === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

function writeView(view: ProductsView): void {
  try {
    localStorage.setItem(PRODUCTS_VIEW_KEY, view);
  } catch {
    // Storage can be unavailable (private mode); the view still works for this session.
  }
}
