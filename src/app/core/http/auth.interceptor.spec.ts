import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { ApiConfigService, BACKEND_STORAGE_KEY } from '../api/api-config.service';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let config: ApiConfigService;
  const token = signal<string | null>('jwt-123');

  beforeEach(() => {
    localStorage.removeItem(BACKEND_STORAGE_KEY);
    token.set('jwt-123');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token } },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    config = TestBed.inject(ApiConfigService);
  });

  afterEach(() => {
    ctrl.verify();
    localStorage.removeItem(BACKEND_STORAGE_KEY);
  });

  const authHeader = (url: string) => {
    http.get(url).subscribe();
    const req = ctrl.expectOne(url);
    req.flush({});
    return req.request.headers.get('Authorization');
  };

  it('adds the bearer token to live API requests', () => {
    config.setMode('live');
    expect(authHeader(`${environment.liveApiUrl}/orders`)).toBe('Bearer jwt-123');
  });

  it('leaves mock mode requests alone', () => {
    expect(authHeader(`${environment.apiUrl}/orders`)).toBeNull();
  });

  it('leaves non-API requests alone in live mode', () => {
    config.setMode('live');
    expect(authHeader(`${config.liveOrigin}/health`)).toBeNull();
    expect(authHeader('/assets/data.json')).toBeNull();
  });

  it('sends nothing when signed out', () => {
    config.setMode('live');
    token.set(null);
    expect(authHeader(`${environment.liveApiUrl}/orders`)).toBeNull();
  });
});
