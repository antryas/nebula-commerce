import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Which backend answers `/api` calls: the in-browser mock or the live .NET API. */
export type BackendMode = 'mock' | 'live';

export const BACKEND_STORAGE_KEY = 'nebula.backend';

/**
 * Runtime choice of backend. API clients read `baseUrl()` on every call, so switching the
 * mode takes effect for the next request without a reload.
 */
@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private readonly _mode = signal<BackendMode>(readMode());

  /** Persisted in localStorage; `mock` unless the user opted into the live API. */
  readonly mode = this._mode.asReadonly();
  readonly baseUrl = computed(() =>
    this._mode() === 'live' ? environment.liveApiUrl : environment.apiUrl,
  );
  /** Origin of the live API (hosts `/health` and `/swagger` outside the API base URL). */
  readonly liveOrigin = new URL(environment.liveApiUrl).origin;

  setMode(mode: BackendMode): void {
    if (mode === this._mode()) return;
    this._mode.set(mode);
    try {
      localStorage.setItem(BACKEND_STORAGE_KEY, mode);
    } catch {
      /* storage unavailable: the choice just won't survive a reload */
    }
  }

  /** True when `url` targets the currently selected API base URL. */
  isApiUrl(url: string): boolean {
    const base = this.baseUrl();
    return url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`);
  }
}

function readMode(): BackendMode {
  try {
    return localStorage.getItem(BACKEND_STORAGE_KEY) === 'live' ? 'live' : 'mock';
  } catch {
    return 'mock';
  }
}
