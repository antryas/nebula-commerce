import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { ApiConfigService } from '../api/api-config.service';
import { BackendStatus, BackendStatusService } from '../api/backend-status.service';
import { BackendSwitch } from '../api/backend-switch';
import { DemoOverlay } from '../api/demo-overlay';

/** Short texts for one backend status, shared by the topbar pill and the Settings card. */
export interface BackendStatusText {
  /** Pill label, e.g. "Live .NET · 42 ms". */
  label: string;
  /** One-line detail under the status heading. */
  detail: string;
  /** Screen-reader announcement; excludes latency so periodic checks stay quiet. */
  announcement: string;
}

export function backendStatusText(
  status: BackendStatus,
  latencyMs: number | null,
): BackendStatusText {
  switch (status) {
    case 'mock':
      return {
        label: 'Mock data',
        detail: 'In-browser mock API',
        announcement: 'Using mock data',
      };
    case 'checking':
      return {
        label: 'Connecting…',
        detail: 'Checking the live API…',
        announcement: 'Connecting to the live API',
      };
    case 'online':
      return {
        label: latencyMs === null ? 'Live .NET' : `Live .NET · ${latencyMs} ms`,
        detail: latencyMs === null ? 'Online' : `Online · ${latencyMs} ms round trip`,
        announcement: 'Live .NET backend online',
      };
    case 'offline':
      return {
        label: 'API offline',
        detail: 'Unreachable, retrying every 30 s',
        announcement: 'Live API offline',
      };
  }
}

/** Topbar pill showing which backend answers requests; opens a menu to switch it. */
@Component({
  selector: 'nb-backend-indicator',
  imports: [MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="nb-backend"
      [attr.data-status]="status.status()"
      [matMenuTriggerFor]="backendMenu"
      [attr.aria-label]="'Data source: ' + text().label + '. Change data source'"
      [attr.title]="text().label"
    >
      <span class="material-symbols-rounded nb-backend__icon" aria-hidden="true">dns</span>
      <span class="nb-backend__dot" aria-hidden="true"></span>
      <span class="nb-backend__label" aria-hidden="true">{{ text().label }}</span>
    </button>
    <span class="sr-only" aria-live="polite">{{ text().announcement }}</span>

    <mat-menu #backendMenu="matMenu" xPosition="before" class="nb-backend-menu">
      <div class="nb-backend-menu__head">
        <p class="nb-backend-menu__title">Data source</p>
        <p class="nb-backend-menu__status" [attr.data-status]="status.status()">
          <span class="nb-backend__dot" aria-hidden="true"></span>
          {{ text().detail }}
        </p>
        @if (readOnly()) {
          <p class="nb-backend-menu__note">
            Live demo is read-only: your changes are validated by the server and kept only in this
            browser tab.
          </p>
        }
      </div>

      <button
        mat-menu-item
        type="button"
        role="menuitemcheckbox"
        class="nb-backend-menu__item"
        [attr.aria-checked]="isLive()"
        (click)="toggle()"
      >
        <span class="material-symbols-rounded" aria-hidden="true">dns</span>
        <span class="nb-backend-menu__toggle-label">Live .NET backend</span>
        <span class="nb-switch" [class.is-on]="isLive()" aria-hidden="true">
          <span class="nb-switch__thumb"></span>
        </span>
      </button>
      <p class="nb-backend-menu__hint">
        Sends requests to the ASP.NET Core API instead of the in-browser mock. Switching signs you
        out.
      </p>

      <a
        mat-menu-item
        class="nb-backend-menu__item"
        [href]="docsUrl"
        target="_blank"
        rel="noopener"
      >
        <span class="material-symbols-rounded" aria-hidden="true">menu_book</span>
        <span>API docs</span>
        <span class="material-symbols-rounded nb-backend-menu__external" aria-hidden="true"
          >open_in_new</span
        >
      </a>
    </mat-menu>
  `,
  styles: `
    :host {
      display: contents;
    }

    .nb-backend {
      --nb-backend-color: var(--nb-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      height: 2.25rem;
      padding: 0 0.75rem;
      border: 1px solid var(--nb-border);
      border-radius: 9999px;
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--nb-muted);
      background: color-mix(in srgb, var(--nb-card) 55%, transparent);
      cursor: pointer;
      transition:
        border-color 150ms ease,
        background-color 150ms ease,
        color 150ms ease;
    }
    .nb-backend:hover {
      border-color: color-mix(in srgb, var(--nb-backend-color) 55%, var(--nb-border));
    }
    .nb-backend:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: 2px;
    }
    .nb-backend[data-status='checking'] {
      --nb-backend-color: var(--nb-info);
    }
    .nb-backend[data-status='online'],
    .nb-backend[data-status='offline'] {
      border-color: color-mix(in srgb, var(--nb-backend-color) 35%, transparent);
      color: color-mix(in srgb, var(--nb-backend-color) 75%, var(--nb-text));
      background: color-mix(in srgb, var(--nb-backend-color) 10%, transparent);
    }
    [data-status='online'] {
      --nb-backend-color: var(--nb-success);
    }
    [data-status='offline'] {
      --nb-backend-color: var(--nb-danger);
    }
    [data-status='checking'] {
      --nb-backend-color: var(--nb-info);
    }
    [data-status='mock'] {
      --nb-backend-color: var(--nb-muted);
    }

    .nb-backend__dot {
      position: relative;
      flex: none;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: var(--nb-backend-color);
    }
    [data-status='online'] > .nb-backend__dot {
      box-shadow: 0 0 10px var(--nb-backend-color);
    }
    [data-status='online'] > .nb-backend__dot::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: var(--nb-backend-color);
      animation: nb-backend-pulse 1.8s ease-out infinite;
    }
    [data-status='checking'] > .nb-backend__dot {
      animation: nb-backend-blink 1s ease-in-out infinite alternate;
    }
    @keyframes nb-backend-pulse {
      from {
        opacity: 0.7;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(3);
      }
    }
    @keyframes nb-backend-blink {
      to {
        opacity: 0.25;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .nb-backend__dot,
      .nb-backend__dot::after {
        animation: none !important;
      }
    }

    .nb-backend-menu__head {
      padding: 0.5rem 1rem 0.75rem;
      margin-bottom: 0.25rem;
      border-bottom: 1px solid var(--nb-border);
    }
    .nb-backend-menu__title {
      margin: 0;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--nb-muted);
    }
    .nb-backend-menu__note {
      max-width: 17rem;
      margin: 0.375rem 0 0;
      font-size: 0.75rem;
      line-height: 1.45;
      color: var(--nb-muted);
    }
    .nb-backend-menu__status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.375rem 0 0;
      font-size: 0.875rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--nb-text);
    }
    [mat-menu-item] .material-symbols-rounded {
      margin-right: 0.75rem;
      font-size: 1.25rem;
      color: var(--nb-muted);
    }
    .nb-backend-menu__item ::ng-deep .mat-mdc-menu-item-text {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 0;
    }
    .nb-backend-menu__toggle-label {
      flex: 1;
    }
    .nb-backend-menu__item .nb-switch {
      margin-left: 1rem;
    }
    .nb-backend-menu__hint {
      margin: 0;
      padding: 0 1rem 0.75rem 3rem;
      font-size: 0.75rem;
      line-height: 1.45;
      color: var(--nb-muted);
    }
    [mat-menu-item] .nb-backend-menu__external {
      margin: 0 0 0 auto;
      font-size: 1rem;
    }

    .nb-backend__icon {
      display: none;
    }

    // Compact: a server glyph with the status dot as a badge, so it doesn't read as a second
    // copy of the live-orders dot right next to it.
    @media (max-width: 639.98px) {
      .nb-backend {
        position: relative;
        justify-content: center;
        width: 2.25rem;
        padding: 0;
      }
      .nb-backend__label {
        display: none;
      }
      .nb-backend__icon {
        display: block;
        width: 1.125rem;
        overflow: hidden;
        font-size: 1.125rem;
      }
      .nb-backend > .nb-backend__dot {
        position: absolute;
        top: 0.3125rem;
        right: 0.3125rem;
        box-shadow: 0 0 0 2px var(--nb-bg);
      }
      .nb-backend[data-status='online'] > .nb-backend__dot {
        box-shadow:
          0 0 0 2px var(--nb-bg),
          0 0 8px var(--nb-backend-color);
      }
    }
  `,
})
export class BackendIndicator {
  private readonly config = inject(ApiConfigService);
  private readonly switcher = inject(BackendSwitch);
  protected readonly status = inject(BackendStatusService);
  private readonly overlay = inject(DemoOverlay);

  protected readonly isLive = computed(() => this.config.mode() === 'live');
  protected readonly readOnly = computed(() => this.isLive() && this.overlay.readOnly());
  protected readonly text = computed(() =>
    backendStatusText(this.status.status(), this.status.latencyMs()),
  );
  protected readonly docsUrl = `${this.config.liveOrigin}/swagger`;

  protected toggle(): void {
    this.switcher.switchTo(this.isLive() ? 'mock' : 'live');
  }
}
