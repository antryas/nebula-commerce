import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CustomersApi } from '../../core/api/customers-api';
import { toApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ApiError, Customer } from '../../models';
import { CountUp } from '../../shared/directives/count-up';
import { Stagger } from '../../shared/directives/stagger';
import { Avatar } from '../../shared/ui/avatar';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { Skeleton } from '../../shared/ui/skeleton';
import { StatusChip } from '../../shared/ui/status-chip';
import { CountryFlag } from './country-flag';
import { NbCurrencyPipe, NbDatePipe } from '../../shared/pipes/intl-format';

const NOTES_KEY = 'nebula.notes.';

function apiErrorOf(e: Error | undefined): ApiError | null {
  return e ? toApiError((e as { cause?: unknown }).cause ?? e) : null;
}

/** Notes are demo-only: kept in this browser, never sent to the API. */
function readNotes(customer: Customer): string {
  try {
    return localStorage.getItem(NOTES_KEY + customer.id) ?? customer.notes;
  } catch {
    return customer.notes;
  }
}

function writeNotes(id: string, notes: string): void {
  try {
    localStorage.setItem(NOTES_KEY + id, notes);
  } catch {
    /* storage unavailable: notes live for this page view only */
  }
}

@Component({
  selector: 'nb-customer-profile-page',
  imports: [
    Avatar,
    CountUp,
    CountryFlag,
    NbCurrencyPipe,
    NbDatePipe,
    ErrorState,
    GlassCard,
    RouterLink,
    Skeleton,
    Stagger,
    StatusChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-profile.html',
  styleUrl: './customer-profile.scss',
})
export class CustomerProfilePage {
  private readonly api = inject(CustomersApi);
  private readonly toasts = inject(ToastService);

  /** Route param bound via `withComponentInputBinding()`. */
  readonly id = input<string>();

  protected readonly profile = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.get(params),
  });

  protected readonly customer = computed(() =>
    this.profile.hasValue() ? this.profile.value().customer : null,
  );
  protected readonly orders = computed(() =>
    this.profile.hasValue() ? this.profile.value().orders : [],
  );
  protected readonly error = computed(() => apiErrorOf(this.profile.error()));
  protected readonly notFound = computed(() => this.error()?.status === 404);

  protected readonly stats = computed(() => {
    const c = this.customer();
    if (!c) return null;
    return {
      orders: c.ordersCount,
      ltv: c.lifetimeValue,
      aov: c.ordersCount ? c.lifetimeValue / c.ordersCount : 0,
    };
  });

  /** Last saved notes for the loaded customer. */
  private readonly savedNotes = linkedSignal(() => {
    const c = this.customer();
    return c ? readNotes(c) : '';
  });
  protected readonly notes = linkedSignal(() => this.savedNotes());

  protected onNotesInput(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value);
  }

  protected saveNotes(): void {
    const c = this.customer();
    const value = this.notes();
    if (!c || value === this.savedNotes()) return;
    writeNotes(c.id, value);
    this.savedNotes.set(value);
    this.toasts.success('Saved', `Notes for ${c.name} updated`);
  }

  protected itemCount(items: { quantity: number }[]): number {
    return items.reduce((sum, i) => sum + i.quantity, 0);
  }
}
