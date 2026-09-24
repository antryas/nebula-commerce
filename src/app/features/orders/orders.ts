import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { map } from 'rxjs';
import { EmptyState } from '../../shared/ui/empty-state';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { PageHeader } from '../../shared/ui/page-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { BulkBar } from './bulk-bar';
import { OrderCards } from './order-cards';
import { downloadText, ordersToCsv } from './order-format';
import { OrdersFilters } from './orders-filters';
import { OrdersTable } from './orders-table';
import { OrdersStore } from './orders.store';

const MOBILE_QUERY = '(max-width: 767.98px)';

/** Orders list: filters, sortable table (cards on mobile), paging and bulk actions. */
@Component({
  selector: 'nb-orders-page',
  imports: [
    BulkBar,
    EmptyState,
    ErrorState,
    GlassCard,
    MatPaginatorModule,
    OrderCards,
    OrdersFilters,
    OrdersTable,
    PageHeader,
    Skeleton,
  ],
  providers: [OrdersStore, provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class Orders {
  protected readonly store = inject(OrdersStore);
  private readonly doc = inject(DOCUMENT);

  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe(MOBILE_QUERY)
      .pipe(map((s) => s.matches)),
    { initialValue: false },
  );

  protected readonly subtitle = computed(() => {
    const total = this.store.result()?.total;
    if (total === undefined) return 'Track and manage every order';
    const count = `${total.toLocaleString('en-US')} ${total === 1 ? 'order' : 'orders'}`;
    return this.store.hasFilters() ? `${count} match your filters` : `${count} in total`;
  });

  /** First load (no data yet) shows skeletons; later loads keep the table and dim it. */
  protected readonly initialLoading = computed(() => this.store.loading() && !this.store.result());

  protected onPage(e: PageEvent): void {
    this.store.setPage(e.pageIndex + 1, e.pageSize);
  }

  protected exportCsv(): void {
    const q = this.store.query();
    downloadText(
      this.doc,
      `nebula-orders-page-${q.page}.csv`,
      ordersToCsv(this.store.items()),
      'text/csv;charset=utf-8',
    );
  }
}
