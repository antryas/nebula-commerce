import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiConfigService, BACKEND_STORAGE_KEY } from '../core/api/api-config.service';
import { MOCK_API_OPTIONS, MockApiOptions, mockApiInterceptor } from './mock-api.interceptor';
// Load the mock backend (faker + seed) with the file, not lazily inside the first test,
// so that one-off cost never counts against a test's timeout.
import './mock-backend';

describe('mockApiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let options: MockApiOptions;

  beforeEach(() => {
    options = { delayMs: () => 0, shouldFail: vi.fn(() => false) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        provideHttpClientTesting(),
        { provide: MOCK_API_OPTIONS, useValue: options },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('passes non-API requests through to the real backend', async () => {
    const pending = firstValueFrom(http.get<{ ok: boolean }>('/assets/data.json'));
    backend.expectOne('/assets/data.json').flush({ ok: true });
    expect(await pending).toEqual({ ok: true });
  });

  it('answers API requests without hitting the backend', async () => {
    await firstValueFrom(http.get('/api/customers?pageSize=1'));
    backend.verify();
  });

  describe('in live mode', () => {
    beforeEach(() => TestBed.inject(ApiConfigService).setMode('live'));
    afterEach(() => localStorage.removeItem(BACKEND_STORAGE_KEY));

    it('lets live API requests reach the real backend', async () => {
      const url = `${environment.liveApiUrl}/customers?pageSize=1`;
      const pending = firstValueFrom(http.get<{ total: number }>(url));
      backend.expectOne(url).flush({ total: 7 });
      expect(await pending).toEqual({ total: 7 });
      expect(options.shouldFail).not.toHaveBeenCalled();
    });

    it('no longer answers mock API URLs', () => {
      http.get('/api/customers').subscribe();
      backend.expectOne('/api/customers').flush({});
    });
  });

  it('simulates random server errors as ApiError', async () => {
    vi.mocked(options.shouldFail).mockReturnValue(true);
    await expect(firstValueFrom(http.get('/api/orders?page=2'))).rejects.toMatchObject({
      status: 500,
      error: { status: 500, code: 'server_error' },
    });
    expect(options.shouldFail).toHaveBeenCalledWith('GET', '/api/orders');
  });
});
