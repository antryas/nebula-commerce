import { ChangeDetectionStrategy, Component, DOCUMENT, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { Avatar } from '../../shared/ui/avatar';
import { AuthService } from '../auth/auth.service';
import { CommandPaletteService } from '../command-palette/command-palette.service';
import { LiveOrdersService } from '../live/live-orders.service';
import { ThemeService } from '../theme/theme.service';
import { BackendIndicator } from './backend-indicator';

/** Title of the deepest active route (`data.title`). */
function pageTitle(router: Router): string {
  let route: ActivatedRouteSnapshot | null = router.routerState.snapshot.root;
  let title = '';
  while (route) {
    title = (route.data['title'] as string | undefined) ?? title;
    route = route.firstChild;
  }
  return title;
}

/**
 * Sticky header: page title, palette trigger, data source, live feed switch, theme toggle and
 * user menu.
 */
@Component({
  selector: 'nb-topbar',
  imports: [Avatar, BackendIndicator, MatMenuModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="nb-icon-btn nb-topbar__menu"
      aria-label="Open navigation"
      (click)="menu.emit()"
    >
      <span class="material-symbols-rounded" aria-hidden="true">menu</span>
    </button>

    <div class="nb-topbar__title">
      <span class="nb-topbar__crumb">Nebula</span>
      <span class="material-symbols-rounded nb-topbar__sep" aria-hidden="true">chevron_right</span>
      <span class="nb-topbar__page">{{ title() }}</span>
    </div>

    <button type="button" class="nb-search" (click)="palette.open()">
      <span class="material-symbols-rounded" aria-hidden="true">search</span>
      <span class="nb-search__text">Search or jump to…</span>
      <kbd class="nb-kbd nb-search__kbd">{{ shortcut }}</kbd>
    </button>

    <div class="nb-topbar__actions">
      <nb-backend-indicator />

      <button
        type="button"
        class="nb-live"
        [class.is-paused]="!live.enabled()"
        [attr.aria-pressed]="live.enabled()"
        [attr.aria-label]="
          live.enabled()
            ? 'Live orders on, ' + live.count() + ' received. Pause'
            : 'Live orders paused. Resume'
        "
        [attr.title]="live.enabled() ? 'Pause live orders' : 'Resume live orders'"
        (click)="toggleLive()"
      >
        <span class="nb-live__dot" aria-hidden="true"></span>
        <span class="nb-live__label">{{ live.enabled() ? 'Live' : 'Paused' }}</span>
        @if (live.count() > 0) {
          <span class="nb-live__count" aria-hidden="true">{{ live.count() }}</span>
        }
      </button>

      <button
        type="button"
        class="nb-icon-btn"
        [attr.aria-label]="
          theme.mode() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        "
        (click)="theme.toggleMode()"
      >
        <span class="material-symbols-rounded nb-theme-icon" aria-hidden="true">{{
          theme.mode() === 'dark' ? 'light_mode' : 'dark_mode'
        }}</span>
      </button>

      @if (auth.user(); as user) {
        <button
          type="button"
          class="nb-account"
          [matMenuTriggerFor]="accountMenu"
          aria-label="Account menu"
        >
          <nb-avatar [src]="user.avatarUrl" [name]="user.name" [size]="34" />
          <span class="material-symbols-rounded nb-account__caret" aria-hidden="true"
            >expand_more</span
          >
        </button>
        <mat-menu #accountMenu="matMenu" xPosition="before" class="nb-account-menu">
          <div class="nb-account-menu__head">
            <p class="nb-account-menu__name">{{ user.name }}</p>
            <p class="nb-account-menu__email">{{ user.email }}</p>
          </div>
          <a mat-menu-item routerLink="/settings">
            <span class="material-symbols-rounded" aria-hidden="true">settings</span>
            <span>Settings</span>
          </a>
          <button mat-menu-item type="button" (click)="logout()">
            <span class="material-symbols-rounded" aria-hidden="true">logout</span>
            <span>Log out</span>
          </button>
        </mat-menu>
      }
    </div>
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      gap: 1rem;
      height: 4.25rem;
      padding: 0 1.5rem;
      border-bottom: 1px solid var(--nb-glass-border);
      background: color-mix(in srgb, var(--nb-bg) 62%, transparent);
      backdrop-filter: blur(18px) saturate(140%);
    }
    .nb-topbar__menu {
      display: none;
    }
    .nb-topbar__title {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
      font-size: 0.9375rem;
    }
    .nb-topbar__crumb {
      color: var(--nb-muted);
    }
    .nb-topbar__sep {
      font-size: 1.125rem;
      width: 1.125rem;
      overflow: hidden;
      color: var(--nb-muted);
    }
    .nb-topbar__page {
      overflow: hidden;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .nb-search {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: min(26rem, 40vw);
      height: 2.5rem;
      margin-left: auto;
      padding: 0 0.5rem 0 0.875rem;
      border: 1px solid var(--nb-glass-border);
      border-radius: 0.875rem;
      font: inherit;
      font-size: 0.875rem;
      color: var(--nb-muted);
      background: color-mix(in srgb, var(--nb-card) 70%, transparent);
      cursor: pointer;
      transition:
        border-color 150ms ease,
        box-shadow 150ms ease;
    }
    .nb-search:hover {
      border-color: color-mix(in srgb, var(--nb-accent-1) 45%, transparent);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--nb-accent-1) 12%, transparent);
    }
    .nb-search:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: 2px;
    }
    .nb-search .material-symbols-rounded {
      width: 1.25rem;
      overflow: hidden;
      font-size: 1.25rem;
    }
    .nb-search__kbd {
      margin-left: auto;
    }

    .nb-topbar__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nb-live {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      height: 2.25rem;
      padding: 0 0.75rem;
      border: 1px solid color-mix(in srgb, var(--nb-success) 35%, transparent);
      border-radius: 9999px;
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      color: color-mix(in srgb, var(--nb-success) 75%, var(--nb-text));
      background: color-mix(in srgb, var(--nb-success) 10%, transparent);
      cursor: pointer;
    }
    .nb-live:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: 2px;
    }
    .nb-live__dot {
      position: relative;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: var(--nb-success);
      box-shadow: 0 0 10px var(--nb-success);
    }
    .nb-live__dot::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: var(--nb-success);
      animation: nb-live-pulse 1.8s ease-out infinite;
    }
    .nb-live__count {
      min-width: 1.25rem;
      padding: 0 0.3125rem;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-variant-numeric: tabular-nums;
      text-align: center;
      color: var(--nb-bg);
      background: var(--nb-success);
    }
    .nb-live.is-paused {
      border-color: var(--nb-border);
      color: var(--nb-muted);
      background: transparent;
    }
    .nb-live.is-paused .nb-live__dot {
      background: var(--nb-muted);
      box-shadow: none;
    }
    .nb-live.is-paused .nb-live__dot::after {
      animation: none;
    }
    .nb-live.is-paused .nb-live__count {
      background: var(--nb-muted);
    }
    @keyframes nb-live-pulse {
      from {
        opacity: 0.7;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(3);
      }
    }

    .nb-theme-icon {
      transition: transform 400ms cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    .nb-icon-btn:hover .nb-theme-icon {
      transform: rotate(-25deg);
    }

    .nb-account {
      display: flex;
      align-items: center;
      gap: 0.125rem;
      padding: 0.125rem 0.25rem 0.125rem 0.125rem;
      border: 0;
      border-radius: 9999px;
      color: var(--nb-muted);
      background: transparent;
      cursor: pointer;
    }
    .nb-account:hover {
      background: color-mix(in srgb, var(--nb-text) 6%, transparent);
    }
    .nb-account:focus-visible {
      outline: 2px solid var(--nb-accent-2);
    }
    .nb-account__caret {
      width: 1.25rem;
      overflow: hidden;
      font-size: 1.25rem;
    }

    .nb-account-menu__head {
      padding: 0.5rem 1rem 0.75rem;
      margin-bottom: 0.25rem;
      border-bottom: 1px solid var(--nb-border);
    }
    .nb-account-menu__name,
    .nb-account-menu__email {
      margin: 0;
    }
    .nb-account-menu__name {
      font-weight: 600;
    }
    .nb-account-menu__email {
      font-size: 0.8125rem;
      color: var(--nb-muted);
    }
    [mat-menu-item] .material-symbols-rounded {
      margin-right: 0.75rem;
      font-size: 1.25rem;
      color: var(--nb-muted);
    }

    @media (max-width: 1023.98px) {
      :host {
        padding: 0 1rem;
        gap: 0.5rem;
      }
      .nb-topbar__menu {
        display: grid;
      }
      .nb-topbar__crumb,
      .nb-topbar__sep {
        display: none;
      }
    }
    @media (max-width: 720px) {
      .nb-search {
        width: 2.5rem;
        padding: 0;
        justify-content: center;
      }
      .nb-search__text,
      .nb-search__kbd,
      .nb-account__caret {
        display: none;
      }
    }
    @media (max-width: 480px) {
      .nb-live {
        width: 2.25rem;
        padding: 0;
        justify-content: center;
      }
      .nb-live__label,
      .nb-live__count {
        display: none;
      }
    }
  `,
})
export class Topbar {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly live = inject(LiveOrdersService);
  protected readonly theme = inject(ThemeService);
  protected readonly palette = inject(CommandPaletteService);

  protected readonly shortcut = /Mac|iPhone|iPad/.test(
    inject(DOCUMENT).defaultView?.navigator.userAgent ?? '',
  )
    ? '⌘ K'
    : 'Ctrl K';

  protected readonly title = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => pageTitle(this.router)),
    ),
    { initialValue: pageTitle(this.router) },
  );

  /** Opens the navigation drawer (small screens). */
  readonly menu = output<void>();

  protected toggleLive(): void {
    this.live.enabled.update((v) => !v);
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
