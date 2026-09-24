import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { RouterLink } from '@angular/router';
import { Order, OrderStatus } from '../../models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time';
import { Avatar } from '../../shared/ui/avatar';
import { StatusChip } from '../../shared/ui/status-chip';
import { PAYMENT_META, itemCount } from './order-format';
import { OrderRowMenu } from './order-row-menu';
import { OrdersStore } from './orders.store';
import { NbCurrencyPipe } from '../../shared/pipes/intl-format';

/** Compact card list used instead of the table on narrow screens. */
@Component({
  selector: 'nb-order-cards',
  imports: [
    Avatar,
    NbCurrencyPipe,
    MatCheckboxModule,
    OrderRowMenu,
    RelativeTimePipe,
    RouterLink,
    StatusChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nb-cards-toolbar">
      <mat-checkbox
        [checked]="store.allOnPageSelected()"
        [indeterminate]="store.someOnPageSelected()"
        (change)="store.toggleAllOnPage()"
        >Select page</mat-checkbox
      >
    </div>
    <ul class="nb-cards" [class.is-loading]="store.loading()">
      @for (o of store.items(); track o.id) {
        <li
          class="nb-card"
          data-order-card
          [class.is-selected]="store.isSelected(o.id)"
          [class.is-fresh]="store.isFresh(o.id)"
        >
          <div class="nb-card__top">
            <mat-checkbox
              class="nb-card__check"
              [checked]="store.isSelected(o.id)"
              (change)="store.toggle(o.id)"
              [aria-label]="'Select order #' + o.number"
            />
            <a class="nb-card__link" [routerLink]="['/orders', o.id]">#{{ o.number }}</a>
            <span class="nb-card__time">{{ o.createdAt | relativeTime }}</span>
            <nb-status-chip [status]="o.status" />
            <nb-order-row-menu
              class="nb-card__menu"
              [order]="o"
              (changeStatus)="setStatus(o, $event)"
            />
          </div>
          <div class="nb-card__customer">
            <nb-avatar [src]="o.customerAvatarUrl" [name]="o.customerName" [size]="36" />
            <div class="nb-card__who">
              <span class="nb-card__name">{{ o.customerName }}</span>
              <span class="nb-card__email">{{ o.customerEmail }}</span>
            </div>
          </div>
          <div class="nb-card__meta">
            <span class="nb-card__pill">
              <span class="material-symbols-rounded" aria-hidden="true">shopping_bag</span>
              {{ itemCount(o) }} {{ itemCount(o) === 1 ? 'item' : 'items' }}
            </span>
            <span class="nb-card__pill">
              <span class="material-symbols-rounded" aria-hidden="true">{{
                payment[o.paymentMethod].icon
              }}</span>
              {{ payment[o.paymentMethod].label }}
            </span>
            <span class="nb-card__total">{{ o.total | currency: 'USD' }}</span>
          </div>
        </li>
      }
    </ul>
  `,
  styleUrl: './order-cards.scss',
})
export class OrderCards {
  protected readonly store = inject(OrdersStore);
  protected readonly payment = PAYMENT_META;
  protected readonly itemCount = itemCount;

  protected setStatus(order: Order, status: OrderStatus): void {
    void this.store.updateStatus(order, status);
  }
}
