import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../notifications/toast.service';
import { ApiConfigService, BackendMode } from './api-config.service';
import { BackendStatusService } from './backend-status.service';

/**
 * User-facing flows around the backend choice. A session belongs to the backend that issued
 * it (a mock token means nothing to the live API), so switching signs the user out.
 */
@Injectable({ providedIn: 'root' })
export class BackendSwitch {
  private readonly config = inject(ApiConfigService);
  private readonly status = inject(BackendStatusService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  /** Selects `mode`, signs out and sends the user to the login page. No-op when unchanged. */
  switchTo(mode: BackendMode): void {
    if (mode === this.config.mode()) return;
    this.config.setMode(mode);
    this.auth.logout();
    void this.router.navigateByUrl('/login');
    this.toasts.show({
      kind: 'info',
      title: mode === 'live' ? 'Switched to live .NET backend' : 'Switched to mock data',
      message: 'Sign in again to continue.',
    });
  }

  /** The live API rejected the session token: sign out once, however many requests failed. */
  sessionExpired(): void {
    if (!this.auth.isAuthenticated()) return;
    this.auth.logout();
    void this.router.navigateByUrl('/login');
    this.toasts.show({ kind: 'error', title: 'Session expired, please sign in again' });
  }

  /**
   * Startup check for a persisted live choice: an unreachable API falls back to the mock.
   * The session is kept, because the mock backend accepts any token.
   */
  async fallBackIfOffline(): Promise<void> {
    if (this.config.mode() !== 'live') return;
    const status = await this.status.check();
    if (status !== 'offline' || this.config.mode() !== 'live') return;
    this.config.setMode('mock');
    this.toasts.show({ kind: 'error', title: 'Live API unavailable — using mock data' });
  }
}
