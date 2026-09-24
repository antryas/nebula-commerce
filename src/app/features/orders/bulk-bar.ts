import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OrderStatus } from '../../models';
import { STATUS_META } from '../../shared/ui/status-chip';
import { OrdersStore } from './orders.store';

const BULK_TARGETS: readonly OrderStatus[] = ['packing', 'shipped', 'delivered', 'cancelled'];

/** Floating bar with bulk status actions; slides up while orders are selected. */
@Component({
  selector: 'nb-bulk-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.selectedCount(); as count) {
      <div
        class="nb-bulk"
        data-bulk-bar
        role="toolbar"
        aria-label="Bulk actions"
        animate.enter="nb-bulk-enter"
        animate.leave="nb-bulk-leave"
      >
        <span class="nb-bulk__count" aria-live="polite">
          <span class="nb-bulk__badge">{{ count }}</span> selected
        </span>
        <span class="nb-bulk__divider" aria-hidden="true"></span>
        <span class="nb-bulk__label">Mark as</span>
        <div class="nb-bulk__actions">
          @for (s of targets; track s) {
            <button
              type="button"
              class="nb-bulk__btn"
              [style.--nb-chip-color]="meta[s].color"
              [disabled]="store.busy()"
              (click)="apply(s)"
            >
              <span class="material-symbols-rounded" aria-hidden="true">{{ meta[s].icon }}</span>
              {{ meta[s].label }}
            </button>
          }
        </div>
        <button
          type="button"
          class="nb-bulk__clear"
          [disabled]="store.busy()"
          (click)="store.clearSelection()"
        >
          Clear
        </button>
      </div>
    }
  `,
  styleUrl: './bulk-bar.scss',
})
export class BulkBar {
  protected readonly store = inject(OrdersStore);
  protected readonly targets = BULK_TARGETS;
  protected readonly meta = STATUS_META;

  protected apply(status: OrderStatus): void {
    void this.store.bulkUpdate(status);
  }
}
