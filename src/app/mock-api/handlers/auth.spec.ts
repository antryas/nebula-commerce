import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../mock-api.interceptor';
import { User } from '../../models';
// Load the mock backend (faker + seed) with the file, not lazily inside the first test,
// so that one-off cost never counts against a test's timeout.
import '../mock-backend';

describe('auth mock API', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
      ],
    });
    http = TestBed.inject(HttpClient);
  });

  it('logs in with a valid password', async () => {
    const r = await firstValueFrom(
      http.post<{ token: string; user: User }>('/api/auth/login', {
        email: 'alex@nebula.store',
        password: 'demo1234',
      }),
    );
    expect(r.token).toBe('demo-token');
    expect(r.user).toMatchObject({ id: 'usr_1', role: 'Admin' });
  });

  it('rejects a short password with 401', async () => {
    await expect(
      firstValueFrom(http.post('/api/auth/login', { email: 'alex@nebula.store', password: '123' })),
    ).rejects.toMatchObject({ status: 401, error: { code: 'invalid_credentials' } });
  });
});
