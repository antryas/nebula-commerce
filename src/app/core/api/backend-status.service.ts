import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export type BackendStatus = 'mock' | 'checking' | 'online' | 'offline';

/** Health-check knobs; overridden in tests for a controllable clock. */
export interface BackendStatusOptions {
  /** How often to re-check while in live mode. */
  intervalMs: number;
  /** A health check slower than this counts as offline. */
  timeoutMs: number;
  /** Monotonic clock used to measure latency. */
  now(): number;
}

export const BACKEND_STATUS_OPTIONS = new InjectionToken<BackendStatusOptions>(
  'BACKEND_STATUS_OPTIONS',
  {
    providedIn: 'root',
    factory: () => ({ intervalMs: 30_000, timeoutMs: 5000, now: () => performance.now() }),
  },
);

/**
 * Reachability of the live API. While the mode is `live` it pings `<liveOrigin>/health`
 * immediately and then every `intervalMs`; in mock mode it stays `mock` and runs no timers.
 */
@Injectable({ providedIn: 'root' })
export class BackendStatusService {
  private readonly config = inject(ApiConfigService);
  private readonly options = inject(BACKEND_STATUS_OPTIONS);
  // Straight to the backend: the health check must skip every interceptor (mock, auth, errors).
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly _status = signal<BackendStatus>('mock');
  private readonly _latencyMs = signal<number | null>(null);
  private pending: Promise<BackendStatus> | null = null;

  readonly status = this._status.asReadonly();
  /** Round-trip time of the last successful health check. */
  readonly latencyMs = this._latencyMs.asReadonly();

  constructor() {
    effect((onCleanup) => {
      if (this.config.mode() !== 'live') {
        this._status.set('mock');
        this._latencyMs.set(null);
        return;
      }
      untracked(() => void this.check());
      const timer = setInterval(() => void this.check(), this.options.intervalMs);
      onCleanup(() => clearInterval(timer));
    });
  }

  /**
   * Pings the live API now. Resolves with the result in any mode, but only updates `status`
   * while the live mode is active. Concurrent calls share one request.
   */
  check(): Promise<BackendStatus> {
    if (this.pending) return this.pending;
    if (this.config.mode() === 'live' && this._status() === 'mock') this._status.set('checking');

    const started = this.options.now();
    this.pending = firstValueFrom(
      this.http
        .get<unknown>(`${this.config.liveOrigin}/health`)
        .pipe(timeout(this.options.timeoutMs)),
    )
      .then(() => this.report('online', Math.round(this.options.now() - started)))
      .catch(() => this.report('offline', null))
      .finally(() => (this.pending = null));
    return this.pending;
  }

  private report(status: BackendStatus, latencyMs: number | null): BackendStatus {
    if (this.config.mode() === 'live') {
      this._status.set(status);
      this._latencyMs.set(latencyMs);
    }
    return status;
  }
}
