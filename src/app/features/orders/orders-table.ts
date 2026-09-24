import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { Order, OrderStatus } from '../../models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time';
import { Avatar } from '../../shared/ui/avatar';
import { StatusChip } from '../../shared/ui/status-chip';
import { PAYMENT_META, itemCount } from './order-format';
import { OrderRowMenu } from './order-row-menu';
import { OrdersStore } from './orders.store';

/** Desktop orders table: sortable Material table with sticky header and row selection. */
@Component({
  selector: 'nb-orders-table',
  imports: [
    Avatar,
    CurrencyPipe,
    MatCheckboxModule,
    MatSortModule,
    MatTableModule,
    OrderRowMenu,
    RelativeTimePipe,
    StatusChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders-table.html',
  styleUrl: './orders-table.scss',
})
export class OrdersTable {
  protected readonly store = inject(OrdersStore);
  private readonly router = inject(Router);

  protected readonly columns = [
    'select',
    'number',
    'customerName',
    'items',
    'total',
    'payment',
    'status',
    'actions',
  ];
  protected readonly itemCount = itemCount;

  /** `number` column sorts by creation time: numbers are assigned chronologically. */
  protected readonly sortActive = computed(() => {
    const sort = this.store.query().sort;
    return sort === 'createdAt' ? 'number' : sort;
  });

  protected onSort(e: Sort): void {
    if (!e.direction) {
      this.store.setSort('createdAt', 'desc');
      return;
    }
    this.store.setSort(e.active === 'number' ? 'createdAt' : e.active, e.direction);
  }

  protected paymentOf(order: Order) {
    return PAYMENT_META[order.paymentMethod];
  }

  protected open(order: Order): void {
    void this.router.navigate(['/orders', order.id]);
  }

  protected setStatus(order: Order, status: OrderStatus): void {
    void this.store.updateStatus(order, status);
  }

  protected trackById = (_: number, o: Order) => o.id;
}
