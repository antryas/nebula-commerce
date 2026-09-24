import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';

/** Shimmering placeholder bars shown while data loads. */
@Component({
  selector: 'nb-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'nb-skeleton',
    role: 'status',
    'aria-live': 'polite',
    'aria-busy': 'true',
  },
  template: `
    <span class="sr-only">{{ label() }}</span>
    @for (w of widths(); track $index) {
      <span
        class="nb-skeleton__bar nb-shimmer"
        aria-hidden="true"
        [style.height.px]="height()"
        [style.width]="w"
      ></span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .nb-skeleton__bar {
      display: block;
      border-radius: 0.5rem;
      opacity: 0.9;
    }
  `,
})
export class Skeleton {
  readonly rows = input(5, { transform: numberAttribute });
  readonly height = input(16, { transform: numberAttribute });
  readonly label = input('Loading…');

  /** Slightly varied widths read as real content; the last row is always shorter. */
  protected readonly widths = computed(() => {
    const n = Math.max(0, Math.floor(this.rows()));
    const pattern = ['100%', '92%', '96%', '88%'];
    return Array.from({ length: n }, (_, i) =>
      i === n - 1 && n > 1 ? '60%' : pattern[i % pattern.length],
    );
  });
}
