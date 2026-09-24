import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { LiveOrdersService } from '../live/live-orders.service';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

const SIDEBAR_KEY = 'nebula.sidebar';

/** Authenticated layout: sidebar + topbar around the routed page. Owns the live order feed. */
@Component({
  selector: 'nb-shell',
  imports: [RouterOutlet, Sidebar, Topbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'nb-shell',
    '[class.nb-shell--collapsed]': 'collapsed()',
  },
  template: `
    <button type="button" class="nb-skip-link" (click)="skipToContent()">Skip to content</button>
    <nb-sidebar
      [collapsed]="collapsed()"
      [open]="drawerOpen()"
      (toggleCollapsed)="toggleCollapsed()"
      (closeDrawer)="drawerOpen.set(false)"
      (navigate)="drawerOpen.set(false)"
    />
    @if (drawerOpen()) {
      <div
        class="nb-shell__scrim"
        aria-hidden="true"
        animate.enter="nb-scrim-in"
        animate.leave="nb-scrim-out"
        (click)="drawerOpen.set(false)"
      ></div>
    }
    <div class="nb-shell__body">
      <nb-topbar (menu)="drawerOpen.set(true)" />
      <main #main class="nb-shell__main" tabindex="-1">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
    .nb-shell__body {
      min-width: 0;
      margin-left: 248px;
      transition: margin-left 260ms cubic-bezier(0.2, 0.7, 0.2, 1);
    }
    :host(.nb-shell--collapsed) .nb-shell__body {
      margin-left: 72px;
    }
    .nb-shell__main {
      max-width: 1440px;
      margin: 0 auto;
      padding: 1.75rem 2rem 3rem;
      outline: none;
      view-transition-name: nb-page;
    }
    .nb-shell__scrim {
      position: fixed;
      inset: 0;
      z-index: 35;
      background: rgba(3, 6, 14, 0.55);
      backdrop-filter: blur(4px);
    }
    .nb-scrim-in {
      animation: nb-fade 200ms ease both;
    }
    .nb-scrim-out {
      animation: nb-fade 200ms ease reverse both;
    }
    @keyframes nb-fade {
      from {
        opacity: 0;
      }
    }
    .nb-skip-link {
      position: fixed;
      top: 0.75rem;
      left: 0.75rem;
      z-index: 100;
      padding: 0.5rem 0.875rem;
      border: 0;
      border-radius: 0.625rem;
      font: inherit;
      color: #fff;
      background: var(--nb-accent-1);
      transform: translateY(-200%);
    }
    .nb-skip-link:focus {
      transform: none;
    }
    @media (min-width: 1024px) {
      .nb-shell__scrim {
        display: none;
      }
    }
    @media (max-width: 1023.98px) {
      .nb-shell__body,
      :host(.nb-shell--collapsed) .nb-shell__body {
        margin-left: 0;
      }
      .nb-shell__main {
        padding: 1.25rem 1rem 2.5rem;
      }
    }
  `,
})
export class Shell {
  private readonly live = inject(LiveOrdersService);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  protected readonly collapsed = signal(readCollapsed());
  protected readonly drawerOpen = signal(false);

  constructor() {
    this.live.start();
    inject(DestroyRef).onDestroy(() => this.live.stop());

    const win = inject(DOCUMENT).defaultView;
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.drawerOpen.set(false);
        // Each page starts at the top (kept here instead of withInMemoryScrolling to save
        // ~4 kB of router code in the initial bundle).
        win?.scrollTo({ top: 0 });
      });

    effect(() => {
      const value = this.collapsed() ? 'collapsed' : 'expanded';
      try {
        localStorage.setItem(SIDEBAR_KEY, value);
      } catch {
        /* storage unavailable */
      }
    });
  }

  protected skipToContent(): void {
    this.main().nativeElement.focus();
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((c) => !c);
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}
