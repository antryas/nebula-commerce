import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ApiConfigService, BACKEND_STORAGE_KEY } from './api-config.service';

describe('ApiConfigService', () => {
  beforeEach(() => localStorage.removeItem(BACKEND_STORAGE_KEY));
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(BACKEND_STORAGE_KEY);
  });

  it('defaults to mock mode and the mock base URL', () => {
    const config = TestBed.inject(ApiConfigService);
    expect(config.mode()).toBe('mock');
    expect(config.baseUrl()).toBe(environment.apiUrl);
  });

  it('exposes the live origin', () => {
    const config = TestBed.inject(ApiConfigService);
    expect(config.liveOrigin).toBe(new URL(environment.liveApiUrl).origin);
    expect(environment.liveApiUrl.startsWith(config.liveOrigin)).toBe(true);
  });

  it('switches the base URL and persists the mode', () => {
    const config = TestBed.inject(ApiConfigService);
    config.setMode('live');
    expect(config.mode()).toBe('live');
    expect(config.baseUrl()).toBe(environment.liveApiUrl);
    expect(localStorage.getItem(BACKEND_STORAGE_KEY)).toBe('live');

    config.setMode('mock');
    expect(config.baseUrl()).toBe(environment.apiUrl);
    expect(localStorage.getItem(BACKEND_STORAGE_KEY)).toBe('mock');
  });

  it('restores a persisted live mode', () => {
    localStorage.setItem(BACKEND_STORAGE_KEY, 'live');
    expect(TestBed.inject(ApiConfigService).mode()).toBe('live');
  });

  it('ignores unknown persisted values', () => {
    localStorage.setItem(BACKEND_STORAGE_KEY, 'bogus');
    expect(TestBed.inject(ApiConfigService).mode()).toBe('mock');
  });

  it('does not write when the mode is unchanged', () => {
    const config = TestBed.inject(ApiConfigService);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    config.setMode('mock');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('survives unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const config = TestBed.inject(ApiConfigService);
    expect(config.mode()).toBe('mock');
    config.setMode('live');
    expect(config.mode()).toBe('live');
  });

  it('recognizes requests to the current base URL only', () => {
    const config = TestBed.inject(ApiConfigService);
    expect(config.isApiUrl(`${environment.apiUrl}/orders?page=1`)).toBe(true);
    expect(config.isApiUrl(`${environment.liveApiUrl}/orders`)).toBe(false);
    expect(config.isApiUrl('/assets/data.json')).toBe(false);
    expect(config.isApiUrl('/apiary')).toBe(false);

    config.setMode('live');
    expect(config.isApiUrl(`${environment.liveApiUrl}/orders`)).toBe(true);
    expect(config.isApiUrl(`${environment.apiUrl}/orders`)).toBe(false);
    expect(config.isApiUrl(`${config.liveOrigin}/health`)).toBe(false);
  });
});
