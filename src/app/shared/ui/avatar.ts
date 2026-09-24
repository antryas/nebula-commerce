import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  numberAttribute,
} from '@angular/core';

/** First letters of the first and last word, uppercased: `Ada Lovelace` → `AL`. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Round user picture that falls back to gradient initials when missing or broken. */
@Component({
  selector: 'nb-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'nb-avatar',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.38',
  },
  template: `
    @if (src() && !failed()) {
      <img
        [src]="src()"
        [alt]="name()"
        [attr.width]="size()"
        [attr.height]="size()"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        (error)="failed.set(true)"
      />
    } @else {
      <span class="nb-avatar__initials" role="img" [attr.aria-label]="name()">{{ letters() }}</span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-grid;
      flex: none;
      place-items: center;
      overflow: hidden;
      border-radius: 9999px;
      background: var(--nb-card);
      box-shadow: 0 0 0 1px var(--nb-border);
      vertical-align: middle;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .nb-avatar__initials {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #fff;
      /* Darkened gradient keeps white initials above 4.5:1 on every accent preset. */
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--nb-accent-1) 78%, #000),
        color-mix(in srgb, var(--nb-accent-2) 62%, #000)
      );
      user-select: none;
    }
  `,
})
export class Avatar {
  readonly src = input<string | null | undefined>(null);
  readonly name = input('');
  readonly size = input(32, { transform: numberAttribute });

  /** Reset whenever a new `src` arrives so a fresh image gets a chance to load. */
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
  protected readonly letters = computed(() => initials(this.name()));
}
