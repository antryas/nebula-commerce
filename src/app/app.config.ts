import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { errorInterceptor } from './core/http/error.interceptor';
import { mockApiInterceptor } from './mock-api/mock-api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // errorInterceptor runs first so it also normalizes errors produced by the mock backend.
    provideHttpClient(
      withFetch(),
      withInterceptors([errorInterceptor, ...(environment.useMockApi ? [mockApiInterceptor] : [])]),
    ),
  ],
};
