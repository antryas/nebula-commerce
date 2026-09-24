import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CustomersApi } from '../../core/api/customers-api';
import { toApiError } from '../../core/http/api-error';
import { ApiError, Customer, Paged, SortDir } from '../../models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time';
import { Avatar } from '../../shared/ui/avatar';
import { EmptyState } from '../../shared/ui/empty-state';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { PageHeader } from '../../shared/ui/page-header';
import { Skeleton } from '../../shared/ui/skeleton';
import { CountryFlag } from './country-flag';
import { NbCurrencyPipe, NbDatePipe } from '../../shared/pipes/intl-format';

export type CustomerSort = 'ordersCount' | 'lifetimeValue' | 'lastOrderAt';

export const PAGE_SIZES = [10, 25, 50] as const;
const SEARCH_DEBOUNCE_MS = 250;

function apiErrorOf(e: Error | undefined): ApiError | null {
  return e ? toApiError((e as { cause?: unknown }).cause ?? e) : null;
}

@Component({
  selector: 'nb-customers-page',
  imports: [
    Avatar,
    CountryFlag,
    NbCurrencyPipe,
    NbDatePipe,
    EmptyState,
    ErrorState,
    GlassCard,
    PageHeader,
    RelativeTimePipe,
    RouterLink,
    Skeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
})
export class Customers {
  private readonly api = inject(CustomersApi);
  private readonly router = inject(Router);

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly searchText = signal('');
  protected readonly search = toSignal(
    toObservable(this.searchText).pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      map((s) => s.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
  protected readonly sort = signal<CustomerSort>('lifetimeValue');
  protected readonly dir = signal<SortDir>('desc');
  protected readonly pageSize = signal<number>(PAGE_SIZES[0]);
  /** Back to the first page whenever the result set changes shape. */
  protected readonly page = linkedSignal({
    source: () => [this.search(), this.sort(), this.dir(), this.pageSize()] as const,
    computation: () => 1,
  });

  protected readonly customers = rxResource({
    params: () => ({
      page: this.page(),
      pageSize: this.pageSize(),
      sort: this.sort(),
      dir: this.dir(),
      search: this.search(),
    }),
    stream: ({ params }) => this.api.list(params),
  });

  /** Last loaded page, kept on screen while the next one loads. */
  protected readonly data = linkedSignal<Paged<Customer> | undefined, Paged<Customer> | undefined>({
    source: () => (this.customers.hasValue() ? this.customers.value() : undefined),
    computation: (next, prev) => next ?? prev?.value,
  });
  protected readonly error = computed(() => apiErrorOf(this.customers.error()));
  protected readonly rows = computed(() => this.data()?.items ?? []);
  protected readonly total = computed(() => this.data()?.total ?? 0);
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (!total) return '0 of 0';
    const start = (this.page() - 1) * this.pageSize() + 1;
    return `${start}–${Math.min(total, start + this.pageSize() - 1)} of ${total}`;
  });

  protected onSearch(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.searchText.set('');
  }

  protected sortBy(key: CustomerSort): void {
    if (this.sort() === key) {
      this.dir.update((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      this.sort.set(key);
      this.dir.set('desc');
    }
  }

  /** Mobile sort picker: always sorts descending (highest first). */
  protected onSortSelect(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as CustomerSort);
    this.dir.set('desc');
  }

  protected ariaSort(key: CustomerSort): 'ascending' | 'descending' | 'none' {
    if (this.sort() !== key) return 'none';
    return this.dir() === 'asc' ? 'ascending' : 'descending';
  }

  protected setPageSize(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(this.pages(), Math.max(1, page)));
  }

  /** Whole-row click opens the profile; real links inside the row handle themselves. */
  protected open(customer: Customer, event?: Event): void {
    if ((event?.target as Element | null)?.closest?.('a')) return;
    void this.router.navigate(['/customers', customer.id]);
  }
}
