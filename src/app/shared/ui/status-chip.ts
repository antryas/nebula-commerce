import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OrderStatus } from '../../models';

export interface StatusMeta {
  label: string;
  /** CSS color expression (design token). */
  color: string;
  /** Material Symbols ligature. */
  icon: string;
}

export const STATUS_META: Record<OrderStatus, StatusMeta> = {
  new: { label: 'New', color: 'var(--nb-info)', icon: 'fiber_new' },
  packing: { label: 'Packing', color: 'var(--nb-warning)', icon: 'inventory_2' },
  shipped: { label: 'Shipped', color: 'var(--nb-shipped)', icon: 'local_shipping' },
  delivered: { label: 'Delivered', color: 'var(--nb-success)', icon: 'task_alt' },
  cancelled: { label: 'Cancelled', color: 'var(--nb-danger)', icon: 'cancel' },
};

/** Tinted pill showing an order status with its icon. */
@Component({
  selector: 'nb-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'nb-status-chip',
    '[attr.data-status]': 'status()',
    '[style.--nb-chip-color]': 'meta().color',
  },
  template: `
    <span class="material-symbols-rounded" aria-hidden="true">{{ meta().icon }}</span>
    <span class="nb-status-chip__label">{{ meta().label }}</span>
  `,
  styles: `
    :host {
      /* Mixing toward the text color keeps AA contrast in both themes. */
      --nb-chip-fg: color-mix(in srgb, var(--nb-chip-color) 72%, var(--nb-text));
      display: inline-flex;
      align-items: center;
      gap: 0.3125rem;
      height: 1.5rem;
      padding: 0 0.625rem 0 0.4375rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1;
      letter-spacing: 0.01em;
      white-space: nowrap;
      color: var(--nb-chip-fg);
      background: color-mix(in srgb, var(--nb-chip-color) 14%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nb-chip-color) 28%, transparent);
    }
    .material-symbols-rounded {
      width: 0.9375rem;
      overflow: hidden;
      font-size: 0.9375rem;
      font-variation-settings: 'FILL' 1;
    }
  `,
})
export class StatusChip {
  readonly status = input.required<OrderStatus>();
  protected readonly meta = computed(() => STATUS_META[this.status()]);
}
