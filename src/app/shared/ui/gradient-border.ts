import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** Wraps projected content with an animated conic accent border while `active`. */
@Component({
  selector: 'nb-gradient-border',
  template: '<div class="nb-gradient-border__inner"><ng-content /></div>',
  styles: `
    :host {
      display: block;
      border-radius: 1rem;
    }
    .nb-gradient-border__inner {
      border-radius: inherit;
      height: 100%;
    }
    :host(.nb-gradient-border) .nb-gradient-border__inner {
      border-radius: calc(1rem - 1px);
      background: var(--nb-card);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.nb-gradient-border]': 'active()',
  },
})
export class GradientBorder {
  readonly active = input(true, { transform: booleanAttribute });
}
