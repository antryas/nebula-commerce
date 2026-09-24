import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Order } from '../../models';
import { CompactCurrencyPipe } from '../../shared/pipes/compact-currency';
import { RelativeTimePipe } from '../../shared/pipes/relative-time';
import { Avatar } from '../../shared/ui/avatar';
import { ErrorState } from '../../shared/ui/error-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { GradientBorder } from '../../shared/ui/gradient-border';
import { PageHeader } from '../../shared/ui/page-header';
import { STATUS_META } from '../../shared/ui/status-chip';
import {
  FULFILLMENT_STATUSES,
  FulfillmentStatus,
  FulfillmentStore,
  nextStatus,
} from './fulfillment.store';

/** Touch needs a long-press so a swipe still scrolls the board horizontally. */
const DRAG_START_DELAY = { touch: 220, mouse: 0 };

/** Kanban board that moves orders New → Packing → Shipped → Delivered. */
@Component({
  selector: 'nb-fulfillment-page',
  imports: [
    Avatar,
    CdkDrag,
    CdkDropList,
    CdkDropListGroup,
    CdkScrollable,
    CompactCurrencyPipe,
    CurrencyPipe,
    ErrorState,
    GlassCard,
    GradientBorder,
    PageHeader,
    RelativeTimePipe,
  ],
  providers: [FulfillmentStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fulfillment.html',
  styleUrl: './fulfillment.scss',
})
export class Fulfillment {
  protected readonly store = inject(FulfillmentStore);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly dragDelay = DRAG_START_DELAY;
  protected readonly placeholderCards = [0, 1, 2];

  /** Column the dragged card came from, while a drag is in progress. */
  protected readonly dragSource = signal<FulfillmentStatus | null>(null);
  /** Column currently under the dragged card (lit with the gradient border). */
  protected readonly dropTarget = signal<FulfillmentStatus | null>(null);

  protected readonly columns = computed(() => {
    const cols = this.store.columns();
    const totals = this.store.totals();
    return FULFILLMENT_STATUSES.map((status) => {
      const next = nextStatus(status);
      return {
        status,
        meta: STATUS_META[status],
        orders: cols[status],
        total: totals[status],
        next: next && STATUS_META[next].label,
      };
    });
  });

  protected readonly openCount = computed(() => {
    const cols = this.store.columns();
    return cols.new.length + cols.packing.length + cols.shipped.length;
  });

  protected readonly openValue = computed(() => {
    const t = this.store.totals();
    return t.new + t.packing + t.shipped;
  });

  protected itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /** Backward columns are dimmed while dragging: the board only moves forward. */
  protected isLocked(status: FulfillmentStatus): boolean {
    const from = this.dragSource();
    return (
      from !== null && FULFILLMENT_STATUSES.indexOf(status) < FULFILLMENT_STATUSES.indexOf(from)
    );
  }

  protected onDragStarted(status: FulfillmentStatus): void {
    this.dragSource.set(status);
  }

  protected onEntered(status: FulfillmentStatus): void {
    this.dropTarget.set(status === this.dragSource() ? null : status);
  }

  protected onExited(status: FulfillmentStatus): void {
    if (this.dropTarget() === status) this.dropTarget.set(null);
  }

  protected onDragEnded(): void {
    this.dragSource.set(null);
    this.dropTarget.set(null);
  }

  protected drop(event: CdkDragDrop<FulfillmentStatus, FulfillmentStatus, Order>): void {
    const order = event.item.data;
    const to = event.container.data;
    const from = event.previousContainer.data;
    if (from === to && event.previousIndex === event.currentIndex) return;
    void this.store.move(order.id, to, event.currentIndex).then(() => {
      if (from !== to) this.announceIfMoved(order, to);
    });
  }

  /** Keyboard alternative to dragging: advance one step and keep focus on the card. */
  protected async advance(order: Order): Promise<void> {
    const to = nextStatus(order.status as FulfillmentStatus);
    if (!to) return;
    const move = this.store.move(order.id, to, 0);
    afterNextRender(() => this.focusCard(order.id), { injector: this.injector });
    await move;
    this.announceIfMoved(order, to);
  }

  private announceIfMoved(order: Order, to: FulfillmentStatus): void {
    if (this.store.columns()[to].some((o) => o.id === order.id)) {
      void this.announcer.announce(`Order #${order.number} moved to ${STATUS_META[to].label}`);
    }
  }

  private focusCard(id: string): void {
    const card = this.host.nativeElement.querySelector<HTMLElement>(`[data-order-id="${id}"]`);
    const target = card?.querySelector<HTMLElement>('.card__advance') ?? card;
    target?.focus({ preventScroll: false });
  }
}
