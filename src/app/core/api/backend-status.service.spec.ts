import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { mockApiInterceptor } from '../../mock-api/mock-api.interceptor';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from '../http/auth.interceptor';
import { errorInterceptor } from '../http/error.interceptor';
import { ApiConfigService, BACKEND_STORAGE_KEY } from './api-config.service';
import { BACKEND_STATUS_OPTIONS, BackendStatusService } from './backend-status.service';

describe('BackendStatusService', () => {
  let ctrl: HttpTestingController;
  let config: ApiConfigService;
  let clock: number;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem(BACKEND_STORAGE_KEY);
    clock = 1000;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([errorInterceptor, authInterceptor, mockApiInterceptor]),
        ),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token: () => 'jwt-123' } },
        {
          provide: BACKEND_STATUS_OPTIONS,
          useValue: { intervalMs: 30_000, timeoutMs: 5000, now: () => clock },
        },
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
    config = TestBed.inject(ApiConfigService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem(BACKEND_STORAGE_KEY);
    vi.useRealTimers();
  });

  const pings = () => ctrl.match(`${config.liveOrigin}/health`);

  function start(): BackendStatusService {
    const s = TestBed.inject(BackendStatusService);
    TestBed.tick();
    return s;
  }

  it("reports 'mock' and never pings in mock mode", async () => {
    const s = start();
    expect(s.status()).toBe('mock');
    expect(s.latencyMs()).toBeNull();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(pings()).toHaveLength(0);
  });

  it('checks at once when live and goes online with the measured latency', async () => {
    config.setMode('live');
    const s = start();
    expect(s.status()).toBe('checking');
    const reqs = pings();
    expect(reqs).toHaveLength(1);
    expect(reqs[0].request.headers.has('Authorization')).toBe(false);
    clock += 42;
    reqs[0].flush({ status: 'Healthy' });
    await vi.advanceTimersByTimeAsync(0);
    expect(s.status()).toBe('online');
    expect(s.latencyMs()).toBe(42);
  });

  it('goes offline on an error response', async () => {
    config.setMode('live');
    const s = start();
    pings()[0].flush({ status: 'Unhealthy' }, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(0);
    expect(s.status()).toBe('offline');
    expect(s.latencyMs()).toBeNull();
  });

  it('goes offline when the health check times out', async () => {
    config.setMode('live');
    const s = start();
    expect(pings()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(s.status()).toBe('offline');
  });

  it('re-checks every interval while live and stops in mock mode', async () => {
    config.setMode('live');
    const s = start();
    pings()[0].flush({ status: 'Healthy' });
    await vi.advanceTimersByTimeAsync(30_000);
    const reqs = pings();
    expect(reqs).toHaveLength(1);
    // A periodic re-check keeps the last known state instead of flashing 'checking'.
    expect(s.status()).toBe('online');
    reqs[0].error(new ProgressEvent('error'));
    await vi.advanceTimersByTimeAsync(0);
    expect(s.status()).toBe('offline');

    config.setMode('mock');
    TestBed.tick();
    expect(s.status()).toBe('mock');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(pings()).toHaveLength(0);
  });

  it('check() resolves with the result and shares an in-flight request', async () => {
    config.setMode('live');
    const s = start();
    const a = s.check();
    const b = s.check();
    const reqs = pings();
    expect(reqs).toHaveLength(1);
    reqs[0].flush({ status: 'Healthy' });
    expect(await a).toBe('online');
    expect(await b).toBe('online');
  });

  it('ignores a result that arrives after switching back to mock', async () => {
    config.setMode('live');
    const s = start();
    const [req] = pings();
    config.setMode('mock');
    TestBed.tick();
    req.flush({ status: 'Healthy' });
    await vi.advanceTimersByTimeAsync(0);
    expect(s.status()).toBe('mock');
    expect(s.latencyMs()).toBeNull();
  });
});
