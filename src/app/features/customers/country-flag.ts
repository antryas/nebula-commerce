import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

/** Small rounded country flag (flagcdn SVG) that falls back to the ISO code when offline. */
@Component({
  selector: 'nb-country-flag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'nb-flag', 'aria-hidden': 'true' },
  template: `
    @if (!failed()) {
      <img
        [src]="src()"
        alt=""
        width="20"
        height="15"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        (error)="failed.set(true)"
      />
    } @else {
      <span>{{ code() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      flex: none;
      place-items: center;
      width: 1.25rem;
      height: 0.9375rem;
      overflow: hidden;
      border-radius: 0.1875rem;
      background: var(--nb-border);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--nb-text) 12%, transparent);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    span {
      font-size: 0.5rem;
      font-weight: 700;
      color: var(--nb-muted);
    }
  `,
})
export class CountryFlag {
  /** ISO 3166-1 alpha-2 code, e.g. `DE`. */
  readonly code = input.required<string>();

  protected readonly src = computed(
    () => `https://flagcdn.com/${encodeURIComponent(this.code().toLowerCase())}.svg`,
  );
  protected readonly failed = linkedSignal({ source: this.code, computation: () => false });
}
