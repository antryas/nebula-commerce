import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ApiConfigService, BACKEND_STORAGE_KEY } from '../api/api-config.service';
import { BackendSwitch } from '../api/backend-switch';
import { ToastService } from '../notifications/toast.service';
import { toApiError } from './api-error';
import { SKIP_ERROR_TOAST, errorInterceptor } from './error.interceptor';

describe('toApiError', () => {
  it('uses an ApiError body when present', () => {
    const e = new HttpErrorResponse({
      status: 404,
      error: { status: 404, code: 'not_found', message: 'Order not found' },
    });
    expect(toApiError(e)).toEqual({ status: 404, code: 'not_found', message: 'Order not found' });
  });

  it('keeps details from the body', () => {
    const e = new HttpErrorResponse({
      status: 422,
      error: { status: 422, code: 'validation', message: 'Bad', details: { name: 'Required' } },
    });
    expect(toApiError(e).details).toEqual({ name: 'Required' });
  });

  it('maps status 0 to a network error', () => {
    expect(toApiError(new HttpErrorResponse({ status: 0 }))).toEqual({
      status: 0,
      code: 'network',
      message: 'Network error. Check your connection.',
    });
  });

  it('falls back to a generic error', () => {
    expect(toApiError(new HttpErrorResponse({ status: 502, error: 'Bad gateway' }))).toEqual({
      status: 502,
      code: 'unknown',
      message: 'Something went wrong',
    });
    expect(toApiError(new Error('boom'))).toMatchObject({ code: 'unknown' });
  });

  it('passes an existing ApiError through', () => {
    const err = { status: 422, code: 'validation', message: 'Bad', details: { name: 'x' } };
    expect(toApiError(err)).toEqual(err);
  });
});

describe('errorInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  it('maps server error body to ApiError and toasts on mutations', async () => {
    const toast = TestBed.inject(ToastService);
    const p = firstValueFrom(http.post('/api/products', {}));
    ctrl
      .expectOne('/api/products')
      .flush(
        { status: 422, code: 'validation', message: 'Invalid product' },
        { status: 422, statusText: 'x' },
      );
    await expect(p).rejects.toMatchObject({ code: 'validation', message: 'Invalid product' });
    expect(toast.toasts()[0].title).toBe('Invalid product');
    expect(toast.toasts()[0].kind).toBe('error');
  });

  it('does not toast on GET', async () => {
    const toast = TestBed.inject(ToastService);
    const p = firstValueFrom(http.get('/api/orders'));
    ctrl.expectOne('/api/orders').flush(null, { status: 500, statusText: 'x' });
    await expect(p).rejects.toMatchObject({ code: 'unknown' });
    expect(toast.toasts()).toHaveLength(0);
  });

  it('does not toast when the request opts out', async () => {
    const toast = TestBed.inject(ToastService);
    const p = firstValueFrom(
      http.post('/api/live/tick', null, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      }),
    );
    ctrl.expectOne('/api/live/tick').flush(null, { status: 500, statusText: 'x' });
    await expect(p).rejects.toMatchObject({ status: 500 });
    expect(toast.toasts()).toHaveLength(0);
  });
});

describe('errorInterceptor with the live API', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let config: ApiConfigService;
  let sessionExpired: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.removeItem(BACKEND_STORAGE_KEY);
    sessionExpired = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: BackendSwitch, useValue: { sessionExpired } },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    config = TestBed.inject(ApiConfigService);
  });

  afterEach(() => localStorage.removeItem(BACKEND_STORAGE_KEY));

  const unauthorized = { status: 401, code: 'unauthorized', message: 'Sign in required' };

  it('ends the session on a 401 from the live API, without the error toast', async () => {
    config.setMode('live');
    const url = `${config.baseUrl()}/products/p1`;
    const p = firstValueFrom(http.delete(url));
    ctrl.expectOne(url).flush(unauthorized, { status: 401, statusText: 'Unauthorized' });
    await expect(p).rejects.toMatchObject({ status: 401 });
    expect(sessionExpired).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(ToastService).toasts()).toHaveLength(0);
  });

  it('leaves a failed live sign-in to the login form', async () => {
    config.setMode('live');
    const url = `${config.baseUrl()}/auth/login`;
    const p = firstValueFrom(http.post(url, {}));
    ctrl.expectOne(url).flush(unauthorized, { status: 401, statusText: 'Unauthorized' });
    await expect(p).rejects.toMatchObject({ status: 401 });
    expect(sessionExpired).not.toHaveBeenCalled();
  });

  it('ignores a 401 in mock mode', async () => {
    const p = firstValueFrom(http.get('/api/orders'));
    ctrl.expectOne('/api/orders').flush(unauthorized, { status: 401, statusText: 'x' });
    await expect(p).rejects.toMatchObject({ status: 401 });
    expect(sessionExpired).not.toHaveBeenCalled();
  });
});
