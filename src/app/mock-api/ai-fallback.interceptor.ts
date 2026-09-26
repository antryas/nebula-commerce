import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, map, mergeMap, throwError } from 'rxjs';
import { ApiConfigService } from '../core/api/api-config.service';
import { toHttpEvent } from './mock-api.interceptor';

const AI_ENDPOINTS: readonly string[] = ['/ai/status', '/ai/ask', '/ai/product-description'];

/**
 * Live mode only: when the live API has no working `/ai` endpoints (an older backend answers
 * 404, or it fails with 5xx or a network error), answers from the in-browser recorded handler
 * instead, so the panel shows the "Recorded demo" badge rather than an error. Validation and
 * rate-limit errors (400, 429) and 401s still reach the caller unchanged.
 * Registered inside `errorInterceptor`, so a fallback never raises an error toast.
 */
export const aiFallbackInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(ApiConfigService);
  if (config.mode() !== 'live' || !config.isApiUrl(req.url)) return next(req);

  const endpoint = req.url.slice(config.baseUrl().length).split('?')[0];
  if (!AI_ENDPOINTS.includes(endpoint)) return next(req);

  return next(req).pipe(
    catchError((e: unknown) => {
      if (!shouldFallBack(e)) return throwError(() => e);
      // The same lazy chunk the mock mode uses; its answers are built from the mock data.
      return from(import('./mock-backend')).pipe(
        map((m) =>
          m.handleMockRequest({
            method: req.method,
            path: `/api${endpoint}`,
            query: new URLSearchParams(),
            body: req.body,
          }),
        ),
        mergeMap((res) => toHttpEvent(req, res)),
      );
    }),
  );
};

function shouldFallBack(e: unknown): boolean {
  if (!(e instanceof HttpErrorResponse)) return false;
  return e.status === 0 || e.status === 404 || e.status >= 500;
}
