import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { BackendSwitch } from './core/api/backend-switch';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { NebulaTitleStrategy } from './core/layout/title-strategy';
import { mockApiInterceptor } from './mock-api/mock-api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withViewTransitions({ skipInitialTransition: true }),
      withComponentInputBinding(),
    ),
    { provide: TitleStrategy, useClass: NebulaTitleStrategy },
    // errorInterceptor runs first so it normalizes errors from both the mock and the live API;
    // the mock interceptor is always present and decides per request (see ApiConfigService).
    provideHttpClient(
      withFetch(),
      withInterceptors([errorInterceptor, authInterceptor, mockApiInterceptor]),
    ),
    // A persisted live choice is verified before the first route loads its data, so an
    // unreachable API degrades to the mock instead of rendering error states.
    provideAppInitializer(() => inject(BackendSwitch).fallBackIfOffline()),
  ],
};
