import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from '../../shared/ui/empty-state';
import { GlassCard } from '../../shared/ui/glass-card';
import { PageHeader } from '../../shared/ui/page-header';

/** Placeholder route; the real screen lands in a later task. */
@Component({
  selector: 'nb-customers-page',
  imports: [EmptyState, GlassCard, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nb-page-header title="Customers" subtitle="People who buy from Nebula" />
    <nb-glass-card [padded]="false">
      <nb-empty-state
        icon="group"
        title="Coming soon"
        message="This screen is under construction."
      />
    </nb-glass-card>
  `,
})
export class Customers {}
