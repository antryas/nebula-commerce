import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Observable, delay, from, map, mergeMap, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiError } from '../models';
import { mockDelayMs, shouldFail } from './latency';
import type { MockResponse } from './router';

/** Network simulation knobs; overridden in tests to get instant, deterministic responses. */
export interface MockApiOptions {
  delayMs(): number;
  shouldFail(method: string, path: string): boolean;
}

export const MOCK_API_OPTIONS = new InjectionToken<MockApiOptions>('MOCK_API_OPTIONS', {
  providedIn: 'root',
  factory: () => ({ delayMs: mockDelayMs, shouldFail }),
});

/**
 * Answers `environment.apiUrl` requests from the in-memory mock backend.
 * Kept deliberately tiny: the seeded database and handlers (faker included) live in
 * `mock-backend.ts`, which is loaded lazily on the first API call.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${environment.apiUrl}/`)) return next(req);

  const options = inject(MOCK_API_OPTIONS);
  const url = new URL(req.urlWithParams, 'http://mock.local');
  const path = url.pathname;

  const response$: Observable<MockResponse> = options.shouldFail(req.method, path)
    ? of(serverError())
    : from(import('./mock-backend')).pipe(
        map((m) =>
          m.handleMockRequest({
            method: req.method,
            path,
            query: url.searchParams,
            body: req.body,
          }),
        ),
      );

  return response$.pipe(
    delay(options.delayMs()),
    mergeMap((res) => toHttpEvent(req, res)),
  );
};

function toHttpEvent(req: HttpRequest<unknown>, res: MockResponse): Observable<HttpEvent<unknown>> {
  if (res.status >= 400) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: res.status,
          statusText: (res.body as ApiError | null)?.code ?? 'error',
          error: res.body,
          url: req.urlWithParams,
        }),
    );
  }
  return of(new HttpResponse({ status: res.status, body: res.body, url: req.urlWithParams }));
}

function serverError(): MockResponse {
  const body: ApiError = {
    status: 500,
    code: 'server_error',
    message: 'Simulated server error. Please try again.',
  };
  return { status: 500, body };
}
