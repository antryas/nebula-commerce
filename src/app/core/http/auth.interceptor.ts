import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiConfigService } from '../api/api-config.service';
import { AuthService } from '../auth/auth.service';

/**
 * Sends the session token to the live API as a bearer token. Mock mode needs no header
 * (the mock backend ignores auth), and non-API URLs never receive the token.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(ApiConfigService);
  if (config.mode() !== 'live' || !config.isApiUrl(req.url)) return next(req);

  const token = inject(AuthService).token();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
