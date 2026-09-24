import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { Order, OrderStatus } from '../../models';
import { STATUS_META } from '../../shared/ui/status-chip';
import { isClosed } from './order-format';

const QUICK_TARGETS: readonly OrderStatus[] = ['packing', 'shipped', 'delivered'];

/** "More" button with View and quick "Mark as …" actions for one order. */
@Component({
  selector: 'nb-order-row-menu',
  imports: [MatMenuModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="nb-icon-btn nb-row-menu__trigger"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="'Actions for order #' + order().number"
    >
      <span class="material-symbols-rounded" aria-hidden="true">more_horiz</span>
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      <a mat-menu-item [routerLink]="['/orders', order().id]">
        <span class="material-symbols-rounded nb-menu-icon" aria-hidden="true">visibility</span>
        View details
      </a>
      @for (s of targets; track s) {
        <button
          type="button"
          mat-menu-item
          [disabled]="closed() || s === order().status"
          (click)="changeStatus.emit(s)"
        >
          <span
            class="material-symbols-rounded nb-menu-icon"
            aria-hidden="true"
            [style.color]="meta[s].color"
            >{{ meta[s].icon }}</span
          >
          Mark as {{ meta[s].label.toLowerCase() }}
        </button>
      }
    </mat-menu>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .nb-row-menu__trigger {
      width: 2.25rem;
      height: 2.25rem;
    }
    .nb-menu-icon {
      width: 1.25rem;
      margin-right: 0.75rem;
      overflow: hidden;
      font-size: 1.25rem;
      vertical-align: middle;
    }
  `,
})
export class OrderRowMenu {
  readonly order = input.required<Order>();
  readonly changeStatus = output<OrderStatus>();

  protected readonly meta = STATUS_META;
  protected readonly targets = QUICK_TARGETS;
  protected readonly closed = computed(() => isClosed(this.order().status));
}
