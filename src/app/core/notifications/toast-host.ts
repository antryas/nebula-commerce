import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastKind, ToastService } from './toast.service';

const ICONS: Record<ToastKind, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  order: 'shopping_bag',
};

/** Fixed bottom-right stack of glass toasts fed by `ToastService`. */
@Component({
  selector: 'nb-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    'aria-label': 'Notifications',
  },
  template: `
    <ol class="nb-toast-stack" aria-live="polite" aria-relevant="additions">
      @for (t of toasts.toasts(); track t.id) {
        <li
          data-toast
          class="nb-glass nb-toast"
          [class]="'nb-toast--' + t.kind"
          animate.enter="nb-toast-enter"
          animate.leave="nb-toast-leave"
          [style.--nb-toast-duration.ms]="t.durationMs"
        >
          <span class="nb-toast__bar" aria-hidden="true"></span>
          <span class="nb-toast__icon material-symbols-rounded" aria-hidden="true">{{
            icons[t.kind]
          }}</span>
          <div class="nb-toast__body">
            <p class="nb-toast__title">{{ t.title }}</p>
            @if (t.message) {
              <p class="nb-toast__message">{{ t.message }}</p>
            }
          </div>
          <button
            type="button"
            class="nb-toast__close"
            aria-label="Dismiss notification"
            (click)="toasts.dismiss(t.id)"
          >
            <span class="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
          @if (t.durationMs > 0) {
            <span class="nb-toast__progress" aria-hidden="true"></span>
          }
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      position: fixed;
      right: 1.25rem;
      bottom: 1.25rem;
      z-index: 1000;
      width: min(24rem, calc(100vw - 2rem));
      pointer-events: none;
    }

    @media (max-width: 480px) {
      :host {
        right: 1rem;
        bottom: 1rem;
        left: 1rem;
        width: auto;
      }
    }

    .nb-toast-stack {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .nb-toast {
      --nb-toast-tint: var(--nb-info);
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: start;
      gap: 0.75rem;
      overflow: hidden;
      padding: 0.875rem 0.75rem 0.875rem 1.125rem;
      border-radius: 1rem;
      color: var(--nb-text);
      pointer-events: auto;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.05) inset,
        0 24px 48px -20px rgba(0, 0, 0, 0.55),
        0 0 0 1px color-mix(in srgb, var(--nb-toast-tint) 14%, transparent);
    }

    .nb-toast--success {
      --nb-toast-tint: var(--nb-success);
    }
    .nb-toast--error {
      --nb-toast-tint: var(--nb-danger);
    }
    .nb-toast--info {
      --nb-toast-tint: var(--nb-info);
    }
    .nb-toast--order {
      --nb-toast-tint: var(--nb-accent-1);
      background:
        radial-gradient(
          120% 140% at 0% 0%,
          color-mix(in srgb, var(--nb-accent-1) 18%, transparent),
          transparent 60%
        ),
        var(--nb-glass-bg);
    }

    .nb-toast__bar {
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: var(--nb-toast-tint);
    }
    .nb-toast--order .nb-toast__bar {
      width: 4px;
      background: linear-gradient(180deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 0 16px 1px color-mix(in srgb, var(--nb-accent-1) 60%, transparent);
    }

    .nb-toast__icon {
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.75rem;
      overflow: hidden;
      font-size: 1.25rem;
      color: var(--nb-toast-tint);
      background: color-mix(in srgb, var(--nb-toast-tint) 16%, transparent);
    }
    .nb-toast--order .nb-toast__icon {
      color: #fff;
      background: linear-gradient(135deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 8px 20px -8px var(--nb-accent-1);
    }

    .nb-toast__body {
      min-width: 0;
      padding-top: 0.125rem;
    }
    .nb-toast__title {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.35;
    }
    .nb-toast__message {
      margin: 0.125rem 0 0;
      font-size: 0.8125rem;
      line-height: 1.4;
      color: var(--nb-muted);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    .nb-toast__close {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border: 0;
      border-radius: 0.5rem;
      color: var(--nb-muted);
      background: transparent;
      cursor: pointer;
      transition:
        color 150ms ease,
        background-color 150ms ease;
    }
    .nb-toast__close:hover {
      color: var(--nb-text);
      background: color-mix(in srgb, var(--nb-text) 8%, transparent);
    }
    .nb-toast__close:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: 1px;
    }
    .nb-toast__close .material-symbols-rounded {
      width: 1.125rem;
      overflow: hidden;
      font-size: 1.125rem;
    }

    .nb-toast__progress {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      height: 2px;
      background: var(--nb-toast-tint);
      opacity: 0.55;
      transform-origin: left;
      animation: nb-toast-progress var(--nb-toast-duration, 4000ms) linear forwards;
    }
    .nb-toast--order .nb-toast__progress {
      background: linear-gradient(90deg, var(--nb-accent-1), var(--nb-accent-2));
    }

    .nb-toast-enter {
      animation: nb-toast-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .nb-toast-leave {
      animation: nb-toast-out 220ms ease-in forwards;
    }

    @keyframes nb-toast-in {
      from {
        opacity: 0;
        transform: translateX(calc(100% + 1.5rem)) scale(0.96);
      }
    }
    @keyframes nb-toast-out {
      to {
        opacity: 0;
        transform: translateX(40%) scale(0.96);
      }
    }
    @keyframes nb-toast-progress {
      from {
        transform: scaleX(1);
      }
      to {
        transform: scaleX(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .nb-toast-enter,
      .nb-toast-leave,
      .nb-toast__progress {
        animation: none;
      }
      .nb-toast__progress {
        display: none;
      }
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
  protected readonly icons = ICONS;
}
