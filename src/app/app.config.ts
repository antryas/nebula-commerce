import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
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
    // errorInterceptor runs first so it also normalizes errors produced by the mock backend.
    provideHttpClient(
      withFetch(),
      withInterceptors([errorInterceptor, ...(environment.useMockApi ? [mockApiInterceptor] : [])]),
    ),
  ],
};
