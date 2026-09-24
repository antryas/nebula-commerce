import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { OrderStatus } from '../../models';
import { STATUS_META } from '../../shared/ui/status-chip';
import { ORDER_STATUSES } from './order-format';
import { OrdersStore } from './orders.store';

/** Search box, status chips and created-at date range for the orders list. */
@Component({
  selector: 'nb-orders-filters',
  imports: [MatDatepickerModule, MatFormFieldModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders-filters.html',
  styleUrl: './orders-filters.scss',
})
export class OrdersFilters {
  protected readonly store = inject(OrdersStore);
  protected readonly statuses = ORDER_STATUSES;
  protected readonly meta = STATUS_META;

  protected readonly range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  protected readonly activeStatus = computed(() => new Set(this.store.query().status));
  protected readonly hasRange = computed(() => !!this.store.query().from);

  constructor() {
    this.range.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ start, end }) => {
      if (start && end) this.store.setRange(startOfDay(start), endOfDay(end));
      else if (!start && !end) this.store.setRange(null, null);
    });

    // Keep the picker in sync when filters are reset elsewhere (e.g. the empty state).
    let hadRange = false;
    effect(() => {
      const has = this.hasRange();
      if (hadRange && !has) this.range.reset(undefined, { emitEvent: false });
      hadRange = has;
    });
  }

  protected onSearch(event: Event): void {
    this.store.setSearch((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.store.setSearch('');
  }

  protected selectAll(): void {
    this.store.setStatus([]);
  }

  protected toggleStatus(status: OrderStatus): void {
    const current = this.store.query().status;
    this.store.setStatus(
      current.includes(status) ? current.filter((s) => s !== status) : [...current, status],
    );
  }

  protected clearRange(): void {
    this.range.setValue({ start: null, end: null });
  }
}

function startOfDay(d: Date): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function endOfDay(d: Date): string {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy.toISOString();
}
