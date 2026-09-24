import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiConfigService } from '../api/api-config.service';
import { BackendSwitch } from '../api/backend-switch';
import { ToastService } from '../notifications/toast.service';
import { toApiError } from './api-error';

/** Set on a request to suppress the automatic error toast (e.g. background polling). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/**
 * Rethrows every HTTP failure as a normalized `ApiError`. Mutations (non-GET) also raise an
 * error toast; reads are expected to render an inline error state instead. A 401 from the
 * live API (other than a failed sign-in) ends the session instead of toasting the error.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const config = inject(ApiConfigService);
  const injector = inject(Injector);
  const isLiveApi = config.mode() === 'live' && config.isApiUrl(req.url) && !isLoginUrl(req.url);

  return next(req).pipe(
    catchError((e: unknown) => {
      const apiError = toApiError(e);
      if (isLiveApi && apiError.status === 401) {
        // Resolved lazily: BackendSwitch depends (through AuthService) on HttpClient itself.
        injector.get(BackendSwitch).sessionExpired();
      } else if (req.method !== 'GET' && !req.context.get(SKIP_ERROR_TOAST)) {
        toast.error(apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};

function isLoginUrl(url: string): boolean {
  return url.split('?')[0].endsWith('/auth/login');
}
