import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Avatar } from '../../shared/ui/avatar';
import { ApiConfigService } from '../api/api-config.service';
import { AuthService } from '../auth/auth.service';
import { LiveOrdersService } from '../live/live-orders.service';
import { NAV_ITEMS } from './nav-items';

/**
 * App navigation. Desktop: fixed rail that collapses to icons (72 px) or shows labels (248 px).
 * Below 1024 px it is an off-canvas drawer controlled by `open`.
 */
@Component({
  selector: 'nb-sidebar',
  imports: [Avatar, CdkTrapFocus, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'nb-sidebar',
    '[class.nb-sidebar--collapsed]': 'collapsed()',
    '[class.nb-sidebar--open]': 'open()',
    '(keydown.escape)': 'closeDrawer.emit()',
  },
  template: `
    <div class="nb-sidebar__inner" [cdkTrapFocus]="open()" [cdkTrapFocusAutoCapture]="open()">
      <div class="nb-sidebar__brand">
        <a routerLink="/overview" class="nb-brand" aria-label="Nebula Commerce home">
          <span class="nb-brand-mark" aria-hidden="true">N</span>
          <span class="nb-brand__text nb-sidebar__fade">
            <span class="nb-brand__name">Nebula</span>
            <span class="nb-brand__tag">Commerce</span>
          </span>
        </a>
        <button
          type="button"
          class="nb-icon-btn nb-sidebar__close"
          aria-label="Close navigation"
          (click)="closeDrawer.emit()"
        >
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      </div>

      <nav class="nb-nav" aria-label="Main">
        <p class="nb-nav__section nb-sidebar__fade">Menu</p>
        <ul>
          @for (item of items; track item.path) {
            <li>
              <a
                class="nb-nav__link"
                [routerLink]="'/' + item.path"
                routerLinkActive="is-active"
                ariaCurrentWhenActive="page"
                [attr.title]="collapsed() ? item.label : null"
                (click)="navigate.emit()"
              >
                <span class="nb-nav__icon material-symbols-rounded" aria-hidden="true">{{
                  item.icon
                }}</span>
                <span class="nb-nav__label nb-sidebar__fade">{{ item.label }}</span>
                @if (item.badge === 'liveOrders' && live.count() > 0) {
                  <span class="nb-nav__badge" [attr.aria-label]="live.count() + ' new'">{{
                    live.count()
                  }}</span>
                }
              </a>
            </li>
          }
        </ul>
      </nav>

      <div class="nb-sidebar__footer">
        <div class="nb-sidebar__promo nb-sidebar__fade">
          <span class="material-symbols-rounded" aria-hidden="true">bolt</span>
          <p>
            <strong>Live demo</strong>
            {{ isLive() ? 'Live .NET API' : 'Mock API' }} with real-time orders. Press
            <kbd class="nb-kbd">Ctrl K</kbd> to jump anywhere.
          </p>
        </div>

        @if (auth.user(); as user) {
          <div class="nb-user">
            <nb-avatar [src]="user.avatarUrl" [name]="user.name" [size]="36" />
            <div class="nb-user__meta nb-sidebar__fade">
              <p class="nb-user__name">{{ user.name }}</p>
              <p class="nb-user__email">{{ user.email }}</p>
            </div>
          </div>
        }

        <button
          type="button"
          class="nb-sidebar__collapse"
          [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          [attr.aria-expanded]="!collapsed()"
          (click)="toggleCollapsed.emit()"
        >
          <span class="material-symbols-rounded" aria-hidden="true">{{
            collapsed() ? 'left_panel_open' : 'left_panel_close'
          }}</span>
          <span class="nb-sidebar__fade">Collapse</span>
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      --nb-sidebar-w: 248px;
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 40;
      width: var(--nb-sidebar-w);
      transition:
        width 260ms cubic-bezier(0.2, 0.7, 0.2, 1),
        transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    :host(.nb-sidebar--collapsed) {
      --nb-sidebar-w: 72px;
    }

    .nb-sidebar__inner {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden auto;
      padding: 1rem 0.75rem;
      border-right: 1px solid var(--nb-glass-border);
      background:
        radial-gradient(
          120% 40% at 0% 0%,
          color-mix(in srgb, var(--nb-accent-1) 12%, transparent),
          transparent 70%
        ),
        color-mix(in srgb, var(--nb-surface) 72%, transparent);
      backdrop-filter: blur(20px) saturate(140%);
    }

    .nb-sidebar__fade {
      transition: opacity 180ms ease;
      white-space: nowrap;
    }
    :host(.nb-sidebar--collapsed) .nb-sidebar__fade {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      opacity: 0;
    }

    /* Brand */
    .nb-sidebar__brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 2.75rem;
      padding: 0 0.25rem 1.25rem;
    }
    .nb-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-radius: 0.875rem;
      color: var(--nb-text);
      text-decoration: none;
    }
    .nb-brand:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: 3px;
    }
    .nb-brand__text {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
    }
    .nb-brand__name {
      font-size: 1.0625rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .nb-brand__tag {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--nb-muted);
    }
    .nb-sidebar__close {
      display: none;
    }

    /* Nav */
    .nb-nav {
      flex: 1;
    }
    .nb-nav ul {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .nb-nav__section {
      margin: 0 0 0.5rem;
      padding: 0 0.75rem;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--nb-muted);
    }
    .nb-nav__link {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      height: 2.75rem;
      padding: 0 0.75rem;
      border-radius: 0.875rem;
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--nb-muted);
      text-decoration: none;
      transition:
        color 150ms ease,
        background-color 150ms ease;
    }
    .nb-nav__link:hover {
      color: var(--nb-text);
      background: color-mix(in srgb, var(--nb-text) 6%, transparent);
    }
    .nb-nav__link:focus-visible {
      outline: 2px solid var(--nb-accent-2);
      outline-offset: -2px;
    }
    .nb-nav__link.is-active {
      color: var(--nb-text);
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--nb-accent-1) 26%, transparent),
        color-mix(in srgb, var(--nb-accent-2) 8%, transparent)
      );
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nb-accent-1) 28%, transparent);
    }
    .nb-nav__link.is-active::before {
      content: '';
      position: absolute;
      top: 0.625rem;
      bottom: 0.625rem;
      left: -0.75rem;
      width: 4px;
      border-radius: 0 4px 4px 0;
      background: linear-gradient(180deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 0 14px 1px var(--nb-accent-1);
    }
    .nb-nav__icon {
      flex: none;
      width: 1.5rem;
      overflow: hidden;
      font-size: 1.375rem;
    }
    .nb-nav__link.is-active .nb-nav__icon {
      color: var(--nb-accent-1);
      font-variation-settings: 'FILL' 1;
    }
    .nb-nav__badge {
      display: grid;
      place-items: center;
      min-width: 1.375rem;
      height: 1.375rem;
      margin-left: auto;
      padding: 0 0.375rem;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #fff;
      background: linear-gradient(135deg, var(--nb-accent-1), var(--nb-accent-2));
      box-shadow: 0 4px 14px -4px var(--nb-accent-1);
    }
    :host(.nb-sidebar--collapsed) .nb-nav__link {
      justify-content: center;
      padding: 0;
    }
    :host(.nb-sidebar--collapsed) .nb-nav__badge {
      position: absolute;
      top: 0.25rem;
      right: 0.25rem;
      min-width: 1.125rem;
      height: 1.125rem;
      padding: 0 0.25rem;
      font-size: 0.625rem;
    }

    /* Footer */
    .nb-sidebar__footer {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding-top: 1rem;
    }
    .nb-sidebar__promo {
      display: flex;
      gap: 0.625rem;
      padding: 0.875rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      line-height: 1.45;
      white-space: normal;
      color: var(--nb-muted);
      background:
        radial-gradient(
          100% 100% at 100% 0%,
          color-mix(in srgb, var(--nb-accent-2) 16%, transparent),
          transparent 70%
        ),
        color-mix(in srgb, var(--nb-accent-1) 10%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nb-accent-1) 20%, transparent);
    }
    .nb-sidebar__promo p {
      margin: 0;
    }
    .nb-sidebar__promo strong {
      display: block;
      margin-bottom: 0.125rem;
      font-size: 0.8125rem;
      color: var(--nb-text);
    }
    .nb-sidebar__promo .material-symbols-rounded {
      flex: none;
      width: 1.25rem;
      overflow: hidden;
      font-size: 1.25rem;
      color: var(--nb-accent-1);
    }
    .nb-user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
      padding: 0.5rem;
      border-radius: 1rem;
      background: color-mix(in srgb, var(--nb-text) 4%, transparent);
    }
    :host(.nb-sidebar--collapsed) .nb-user {
      justify-content: center;
      padding: 0.5rem 0;
      background: transparent;
    }
    .nb-user__meta {
      min-width: 0;
    }
    .nb-user__name,
    .nb-user__email {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .nb-user__name {
      font-size: 0.875rem;
      font-weight: 600;
    }
    .nb-user__email {
      font-size: 0.75rem;
      color: var(--nb-muted);
    }
    .nb-sidebar__collapse {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      height: 2.5rem;
      padding: 0 0.75rem;
      border: 0;
      border-radius: 0.75rem;
      font: inherit;
      font-size: 0.8125rem;
      color: var(--nb-muted);
      background: transparent;
      cursor: pointer;
    }
    .nb-sidebar__collapse:hover {
      color: var(--nb-text);
      background: color-mix(in srgb, var(--nb-text) 6%, transparent);
    }
    .nb-sidebar__collapse:focus-visible {
      outline: 2px solid var(--nb-accent-2);
    }
    .nb-sidebar__collapse .material-symbols-rounded {
      width: 1.5rem;
      overflow: hidden;
      font-size: 1.25rem;
    }
    :host(.nb-sidebar--collapsed) .nb-sidebar__collapse {
      justify-content: center;
      padding: 0;
    }

    /* Drawer mode */
    @media (max-width: 1023.98px) {
      :host,
      :host(.nb-sidebar--collapsed) {
        --nb-sidebar-w: min(280px, 85vw);
        transform: translateX(-100%);
        visibility: hidden;
        transition:
          transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1),
          visibility 0s linear 300ms;
      }
      :host(.nb-sidebar--open) {
        transform: none;
        visibility: visible;
        transition: transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      :host(.nb-sidebar--open) .nb-sidebar__inner {
        box-shadow: 30px 0 80px -20px rgba(0, 0, 0, 0.6);
        background:
          radial-gradient(
            120% 40% at 0% 0%,
            color-mix(in srgb, var(--nb-accent-1) 14%, transparent),
            transparent 70%
          ),
          color-mix(in srgb, var(--nb-surface) 92%, transparent);
      }
      /* The drawer always shows labels. */
      :host(.nb-sidebar--collapsed) .nb-sidebar__fade {
        position: static;
        width: auto;
        height: auto;
        overflow: visible;
        clip-path: none;
        opacity: 1;
      }
      :host(.nb-sidebar--collapsed) .nb-nav__link {
        justify-content: flex-start;
        padding: 0 0.75rem;
      }
      :host(.nb-sidebar--collapsed) .nb-nav__badge {
        position: static;
      }
      .nb-sidebar__close {
        display: grid;
      }
      .nb-sidebar__collapse {
        display: none;
      }
    }
  `,
})
export class Sidebar {
  protected readonly auth = inject(AuthService);
  protected readonly live = inject(LiveOrdersService);
  private readonly apiConfig = inject(ApiConfigService);
  protected readonly isLive = computed(() => this.apiConfig.mode() === 'live');
  protected readonly items = NAV_ITEMS;

  readonly collapsed = input(false, { transform: booleanAttribute });
  /** Drawer state (below 1024 px only). */
  readonly open = input(false, { transform: booleanAttribute });

  readonly toggleCollapsed = output<void>();
  readonly closeDrawer = output<void>();
  /** A nav link was activated (the shell closes the drawer). */
  readonly navigate = output<void>();
}
