import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router, RouterLink } from '@angular/router';
import { Product, ProductCategory, SortDir, StockFilter } from '../../models';
import { Stagger } from '../../shared/directives/stagger';
import { EmptyState } from '../../shared/ui/empty-state';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { PageHeader } from '../../shared/ui/page-header';
import { ConfirmService } from './confirm.service';
import { ProductCard, stockLabel, stockLevel } from './product-card';
import { PRODUCT_CATEGORIES } from './product-form';
import { ProductsStore, ProductsView } from './products.store';

interface SortOption {
  value: string;
  label: string;
  sort: string;
  dir: SortDir;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { value: 'newest', label: 'Newest', sort: 'createdAt', dir: 'desc' },
  { value: 'best', label: 'Best selling', sort: 'sold', dir: 'desc' },
  { value: 'price-asc', label: 'Price: low to high', sort: 'price', dir: 'asc' },
  { value: 'price-desc', label: 'Price: high to low', sort: 'price', dir: 'desc' },
  { value: 'stock-asc', label: 'Stock: lowest first', sort: 'stock', dir: 'asc' },
  { value: 'name', label: 'Name A–Z', sort: 'name', dir: 'asc' },
];

const STOCK_FILTERS: readonly { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low' },
  { value: 'out', label: 'Out' },
];

@Component({
  selector: 'nb-products-page',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    EmptyState,
    ErrorState,
    GlassCard,
    MatPaginatorModule,
    MatSlideToggleModule,
    PageHeader,
    ProductCard,
    RouterLink,
    Stagger,
  ],
  providers: [ProductsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products {
  protected readonly store = inject(ProductsStore);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly categories = PRODUCT_CATEGORIES;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly stockFilters = STOCK_FILTERS;
  protected readonly skeletons = Array.from({ length: 8 }, (_, i) => i);
  protected readonly stockLevel = stockLevel;
  protected readonly stockLabel = stockLabel;

  protected readonly subtitle = computed(() => {
    const total = this.store.result()?.total;
    return total == null ? 'Your catalog and stock levels' : `${total} products in your catalog`;
  });

  protected readonly sortValue = computed(() => {
    const q = this.store.query();
    return SORT_OPTIONS.find((o) => o.sort === q.sort && o.dir === q.dir)?.value ?? 'newest';
  });

  protected setView(view: ProductsView): void {
    this.store.view.set(view);
  }

  protected onSearch(event: Event): void {
    this.store.setSearch((event.target as HTMLInputElement).value);
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.setCategory(value ? (value as ProductCategory) : null);
  }

  protected onSort(event: Event): void {
    const option = SORT_OPTIONS.find((o) => o.value === (event.target as HTMLSelectElement).value);
    if (option) this.store.setSort(option.sort, option.dir);
  }

  protected onPage(e: PageEvent): void {
    this.store.setPage(e.pageIndex + 1, e.pageSize);
  }

  protected edit(p: Product): void {
    void this.router.navigate(['/products', p.id, 'edit']);
  }

  protected async remove(p: Product): Promise<void> {
    if (!this.confirm.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await this.store.remove(p.id);
    } catch {
      // The error interceptor already shows a toast for failed mutations.
    }
  }

  protected toggleActive(p: Product, active: boolean): void {
    void this.store.setActive(p, active);
  }
}
