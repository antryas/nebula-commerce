import { Directive, input, numberAttribute } from '@angular/core';

/**
 * Staggered entrance: marks the host as `nb-stagger-item` and exposes its position as
 * `--nb-stagger-index`, which `_effects.scss` turns into an animation delay.
 */
@Directive({
  selector: '[nbStagger]',
  host: {
    class: 'nb-stagger-item',
    '[style.--nb-stagger-index]': 'nbStagger()',
  },
})
export class Stagger {
  readonly nbStagger = input(0, { transform: numberAttribute });
}
