import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { MOCK_API_OPTIONS, MockApiOptions, mockApiInterceptor } from './mock-api.interceptor';

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

  it('simulates random server errors as ApiError', async () => {
    vi.mocked(options.shouldFail).mockReturnValue(true);
    await expect(firstValueFrom(http.get('/api/orders?page=2'))).rejects.toMatchObject({
      status: 500,
      error: { status: 500, code: 'server_error' },
    });
    expect(options.shouldFail).toHaveBeenCalledWith('GET', '/api/orders');
  });
});
