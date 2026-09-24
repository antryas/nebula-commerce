import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../notifications/toast.service';
import { toApiError } from './api-error';

/** Set on a request to suppress the automatic error toast (e.g. background polling). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/**
 * Rethrows every HTTP failure as a normalized `ApiError`. Mutations (non-GET) also raise an
 * error toast; reads are expected to render an inline error state instead.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((e: unknown) => {
      const apiError = toApiError(e);
      if (req.method !== 'GET' && !req.context.get(SKIP_ERROR_TOAST)) {
        toast.error(apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};
