import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AiApi } from '../core/api/ai-api';
import { ApiConfigService, BACKEND_STORAGE_KEY } from '../core/api/api-config.service';
import { errorInterceptor } from '../core/http/error.interceptor';
import { ToastService } from '../core/notifications/toast.service';
import { aiFallbackInterceptor } from './ai-fallback.interceptor';
// Load the mock backend with the file so its one-off cost never counts against a test.
import './mock-backend';

const API = environment.liveApiUrl;

function setup(mode: 'live' | 'mock' = 'live') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor, aiFallbackInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  TestBed.inject(ApiConfigService).setMode(mode);
  return {
    ai: TestBed.inject(AiApi),
    ctrl: TestBed.inject(HttpTestingController),
    toasts: TestBed.inject(ToastService),
  };
}

describe('aiFallbackInterceptor', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem(BACKEND_STORAGE_KEY);
  });

  it('answers from recorded data when the live API has no /ai endpoints (404)', async () => {
    const { ai, ctrl, toasts } = setup();
    const pending = firstValueFrom(ai.ask({ question: 'Who are my most valuable customers?' }));
    ctrl.expectOne(`${API}/ai/ask`).flush(null, { status: 404, statusText: 'Not Found' });
    const res = await pending;
    expect(res.mode).toBe('recorded');
    expect(res.toolsUsed.length).toBeGreaterThan(0);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('writes a recorded description on a 5xx', async () => {
    const { ai, ctrl, toasts } = setup();
    const pending = firstValueFrom(
      ai.productDescription({ name: 'Aurora Lamp', category: 'Home', tone: 'friendly' }),
    );
    ctrl
      .expectOne(`${API}/ai/product-description`)
      .flush(null, { status: 503, statusText: 'Unavailable' });
    const res = await pending;
    expect(res.mode).toBe('recorded');
    expect(res.description).toContain('Aurora Lamp');
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('reports recorded status on a network error', async () => {
    const { ai, ctrl } = setup();
    const pending = firstValueFrom(ai.status());
    ctrl.expectOne(`${API}/ai/status`).error(new ProgressEvent('error'));
    expect(await pending).toMatchObject({ enabled: false, provider: null });
  });

  it('keeps rate-limit and validation errors', async () => {
    const { ai, ctrl } = setup();
    const limited = firstValueFrom(ai.ask({ question: 'Hi' }, { silent: true }));
    ctrl.expectOne(`${API}/ai/ask`).flush(null, { status: 429, statusText: 'Too Many' });
    await expect(limited).rejects.toMatchObject({ status: 429, code: 'rate_limited' });

    const invalid = firstValueFrom(ai.ask({ question: '' }, { silent: true }));
    ctrl
      .expectOne(`${API}/ai/ask`)
      .flush(
        { title: 'Invalid', status: 400, errors: { Question: ['Required'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await expect(invalid).rejects.toMatchObject({ status: 400, code: 'validation' });
  });

  it('leaves other live endpoints alone', async () => {
    const { ctrl } = setup();
    const pending = firstValueFrom(TestBed.inject(HttpClient).get(`${API}/orders`));
    ctrl.expectOne(`${API}/orders`).flush(null, { status: 404, statusText: 'Not Found' });
    await expect(pending).rejects.toMatchObject({ status: 404 });
  });

  it('does nothing in mock mode', async () => {
    const { ai, ctrl } = setup('mock');
    const pending = firstValueFrom(ai.status());
    ctrl.expectOne('/api/ai/status').flush(null, { status: 404, statusText: 'Not Found' });
    await expect(pending).rejects.toMatchObject({ status: 404 });
  });
});
