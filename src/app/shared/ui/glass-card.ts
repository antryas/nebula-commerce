import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** Frosted-glass surface used as the base container for dashboard widgets. */
@Component({
  selector: 'nb-glass-card',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'nb-glass block rounded-2xl',
    '[class.p-5]': 'padded()',
  },
})
export class GlassCard {
  readonly padded = input(true, { transform: booleanAttribute });
}
