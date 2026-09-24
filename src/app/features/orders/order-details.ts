import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmptyState } from '../../shared/ui/empty-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { PageHeader } from '../../shared/ui/page-header';

/** Placeholder route; the real screen lands in a later task. */
@Component({
  selector: 'nb-order-details-page',
  imports: [EmptyState, GlassCard, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-page-header title="Order details" subtitle="Items, customer and status timeline" />
    <nb-glass-card [padded]="false">
      <nb-empty-state
        icon="receipt_long"
        title="Coming soon"
        message="This screen is under construction."
      />
    </nb-glass-card>
  `,
})
export class OrderDetails {
  /** Route param bound via `withComponentInputBinding()`. */
  readonly id = input<string>();
}
