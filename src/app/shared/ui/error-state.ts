import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ApiError } from '../../models';

/** Inline failure panel with the API error message and a Retry action. */
@Component({
  selector: 'nb-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `title` is an input; drop the static attribute so it doesn't become a native tooltip.
  host: { class: 'block', '[attr.title]': 'null' },
  template: `
    <div class="nb-state" role="alert">
      <span class="nb-state__icon material-symbols-rounded" aria-hidden="true">cloud_off</span>
      <h3 class="nb-state__title">{{ title() }}</h3>
      <p class="nb-state__message">{{ error()?.message ?? 'Something went wrong' }}</p>
      @if (error(); as e) {
        @if (e.status) {
          <p class="nb-state__code">Error {{ e.status }} · {{ e.code }}</p>
        }
      }
      <button type="button" class="nb-state__retry" (click)="retry.emit()">
        <span class="material-symbols-rounded" aria-hidden="true">refresh</span>
        Retry
      </button>
    </div>
  `,
  styles: `
    .nb-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2.5rem 1.5rem;
      text-align: center;
    }
    .nb-state__icon {
      display: grid;
      place-items: center;
      width: 3.25rem;
      height: 3.25rem;
      margin-bottom: 0.5rem;
      overflow: hidden;
      border-radius: 1rem;
      font-size: 1.625rem;
      color: color-mix(in srgb, var(--nb-danger) 80%, var(--nb-text));
      background: color-mix(in srgb, var(--nb-danger) 14%, transparent);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--nb-danger) 24%, transparent);
    }
    .nb-state__title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--nb-text);
    }
    .nb-state__message {
      max-width: 28rem;
      margin: 0;
      font-size: 0.875rem;
      color: var(--nb-muted);
    }
    .nb-state__code {
      margin: 0;
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      color: var(--nb-muted);
      opacity: 0.85;
    }
    .nb-state__retry {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      height: 2.25rem;
      margin-top: 0.75rem;
      padding: 0 1rem;
      border: 1px solid var(--nb-border);
      border-radius: 0.75rem;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--nb-text);
      background: var(--nb-card);
      cursor: pointer;
      transition:
        border-color 150ms ease,
        background-color 150ms ease;
    }
    .nb-state__retry:hover {
      border-color: color-mix(in srgb, var(--nb-accent-1) 60%, var(--nb-border));
      background: color-mix(in srgb, var(--nb-accent-1) 10%, var(--nb-card));
    }
    .nb-state__retry:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: 2px;
    }
    .nb-state__retry .material-symbols-rounded {
      width: 1.125rem;
      overflow: hidden;
      font-size: 1.125rem;
    }
  `,
})
export class ErrorState {
  readonly error = input<ApiError | null | undefined>(null);
  readonly title = input("Couldn't load data");
  readonly retry = output<void>();
}
