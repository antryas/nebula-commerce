import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  DestroyRef,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { CommandPaletteService } from './core/command-palette/command-palette.service';
import { AuroraBackground } from './core/layout/aurora-background';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [AuroraBackground, RouterOutlet],
  styleUrl: './app.scss',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly palette = inject(CommandPaletteService);

  constructor() {
    // Applies the stored theme and accent to <html> before the first route renders.
    inject(ThemeService);

    // The global toast stack is mounted right after bootstrap from its own chunk (~6 kB of
    // styles and markup kept out of the initial bundle). Toasts raised earlier are simply
    // rendered once it lands, because their state lives in ToastService.
    const vcr = inject(ViewContainerRef);
    let destroyed = false;
    let toastHost: ComponentRef<unknown> | null = null;
    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      toastHost?.destroy();
    });
    void import('./core/notifications/toast-host').then(({ ToastHost }) => {
      if (!destroyed) toastHost = vcr.createComponent(ToastHost);
    });
  }

  /** Global Ctrl/Cmd+K toggles the command palette (signed-in users only). */
  protected onKeydown(e: KeyboardEvent): void {
    const isShortcut =
      (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
    if (!isShortcut || !this.auth.isAuthenticated()) return;
    e.preventDefault();
    this.palette.toggle();
  }
}
