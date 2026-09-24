import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MOCK_API_OPTIONS, mockApiInterceptor } from '../mock-api.interceptor';
// Preload the lazily imported mock backend so the first request is fast inside a test.
import '../mock-backend';
import { mockDb } from '../db';

describe('demo mock API', () => {
  let http: HttpClient;

  beforeEach(() => {
    mockDb.reset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: MOCK_API_OPTIONS, useValue: { delayMs: () => 0, shouldFail: () => false } },
      ],
    });
    http = TestBed.inject(HttpClient);
  });

  it('restores the seeded database and answers 204', async () => {
    const seededOrders = mockDb.data.orders.length;
    mockDb.data.orders.splice(0, 10);
    mockDb.data.customers[0].name = 'Changed';

    const res = await firstValueFrom(http.post('/api/demo/reset', null, { observe: 'response' }));

    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
    expect(mockDb.data.orders).toHaveLength(seededOrders);
    expect(mockDb.data.customers[0].name).not.toBe('Changed');
  });
});
