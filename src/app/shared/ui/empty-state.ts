import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Friendly "nothing here" panel with an optional projected call to action. */
@Component({
  selector: 'nb-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `title` is an input; drop the static attribute so it doesn't become a native tooltip.
  host: { class: 'block', '[attr.title]': 'null' },
  template: `
    <div class="nb-empty">
      <span class="nb-empty__icon" aria-hidden="true">
        <span class="material-symbols-rounded">{{ icon() }}</span>
      </span>
      <h3 class="nb-empty__title">{{ title() }}</h3>
      @if (message()) {
        <p class="nb-empty__message">{{ message() }}</p>
      }
      <div class="nb-empty__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .nb-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2.5rem 1.5rem;
      text-align: center;
    }
    .nb-empty__icon {
      position: relative;
      display: grid;
      place-items: center;
      width: 3.5rem;
      height: 3.5rem;
      margin-bottom: 0.5rem;
      border-radius: 1.125rem;
      color: var(--nb-accent-1);
      background:
        linear-gradient(
          135deg,
          color-mix(in srgb, var(--nb-accent-1) 18%, transparent),
          color-mix(in srgb, var(--nb-accent-2) 12%, transparent)
        ),
        var(--nb-card);
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--nb-accent-1) 24%, transparent),
        0 16px 32px -16px color-mix(in srgb, var(--nb-accent-1) 60%, transparent);
    }
    .nb-empty__icon .material-symbols-rounded {
      width: 1.75rem;
      overflow: hidden;
      font-size: 1.75rem;
    }
    .nb-empty__title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--nb-text);
    }
    .nb-empty__message {
      max-width: 28rem;
      margin: 0;
      font-size: 0.875rem;
      color: var(--nb-muted);
    }
    .nb-empty__actions:not(:empty) {
      margin-top: 0.75rem;
    }
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input('');
}
