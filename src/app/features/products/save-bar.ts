import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/**
 * Sticky editor footer with the save state and Discard / Save actions. Must be placed inside
 * a `<form>`: the Save button is a native submit button.
 */
@Component({
  selector: 'nb-save-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.nb-save-bar--dirty]': 'dirty()' },
  template: `
    <p class="nb-save-bar__status" aria-live="polite">
      <span class="nb-save-bar__dot" aria-hidden="true"></span>
      {{ dirty() ? 'Unsaved changes' : idleText() }}
    </p>
    <div class="nb-save-bar__actions">
      <button
        type="button"
        class="nb-btn"
        [disabled]="!dirty() || pending()"
        (click)="discard.emit()"
      >
        Discard
      </button>
      <button
        type="submit"
        class="nb-btn nb-btn--primary nb-save-bar__save"
        [disabled]="!canSave()"
      >
        @if (pending()) {
          <span class="nb-save-bar__spinner" aria-hidden="true"></span>
          Saving…
        } @else {
          <span class="material-symbols-rounded" aria-hidden="true">check</span>
          {{ saveLabel() }}
        }
      </button>
    </div>
  `,
  styles: `
    :host {
      position: sticky;
      bottom: 1rem;
      z-index: 5;
      display: flex;
      grid-column: 1 / -1;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 0.75rem 0.75rem 1.125rem;
      border: 1px solid var(--nb-glass-border);
      border-radius: 1.125rem;
      background: color-mix(in srgb, var(--nb-card) 82%, transparent);
      backdrop-filter: blur(18px) saturate(150%);
      box-shadow: 0 24px 48px -20px rgba(0, 0, 0, 0.55);
      transition:
        border-color 200ms ease,
        box-shadow 200ms ease;
    }
    :host(.nb-save-bar--dirty) {
      --nb-dot: var(--nb-warning);
      border-color: color-mix(in srgb, var(--nb-accent-1) 45%, var(--nb-glass-border));
      box-shadow:
        0 24px 48px -20px rgba(0, 0, 0, 0.55),
        0 0 0 4px color-mix(in srgb, var(--nb-accent-1) 10%, transparent);
    }
    .nb-save-bar__status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-size: 0.875rem;
      color: var(--nb-muted);
    }
    .nb-save-bar__dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: var(--nb-dot, var(--nb-success));
      box-shadow: 0 0 8px var(--nb-dot, var(--nb-success));
    }
    .nb-save-bar__actions {
      display: flex;
      gap: 0.5rem;
      margin-left: auto;
    }
    .nb-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 2.5rem;
      padding: 0 1rem;
      border: 1px solid var(--nb-border);
      border-radius: 0.75rem;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      white-space: nowrap;
      color: var(--nb-text);
      background: var(--nb-card);
      cursor: pointer;
      transition:
        transform 150ms ease,
        border-color 150ms ease,
        background-color 150ms ease,
        box-shadow 150ms ease;
    }
    .nb-btn:hover:not(:disabled) {
      border-color: color-mix(in srgb, var(--nb-accent-1) 55%, var(--nb-border));
    }
    .nb-btn:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: 2px;
    }
    .nb-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .nb-btn--primary {
      border-color: transparent;
      color: #fff;
      background: linear-gradient(135deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 10px 24px -12px var(--nb-accent-1);
    }
    .nb-btn--primary:hover:not(:disabled) {
      border-color: transparent;
      box-shadow: 0 14px 30px -12px var(--nb-accent-1);
      transform: translateY(-1px);
    }
    .nb-btn .material-symbols-rounded {
      width: 1.25rem;
      overflow: hidden;
      font-size: 1.25rem;
    }
    .nb-save-bar__spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      border-radius: 9999px;
      animation: nb-save-spin 700ms linear infinite;
    }
    @keyframes nb-save-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (max-width: 639.98px) {
      :host {
        bottom: 0.5rem;
        padding: 0.625rem;
      }
      .nb-save-bar__status {
        display: none;
      }
      .nb-save-bar__actions {
        width: 100%;
      }
      .nb-save-bar__actions .nb-btn {
        flex: 1;
      }
    }
  `,
})
export class SaveBar {
  readonly dirty = input(false, { transform: booleanAttribute });
  readonly pending = input(false, { transform: booleanAttribute });
  readonly canSave = input(false, { transform: booleanAttribute });
  readonly idleText = input('All changes saved');
  readonly saveLabel = input('Save product');

  readonly discard = output<void>();
}
