import { isScreenshotMode, mockDelayMs, shouldFail } from './latency';

describe('latency', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is not in screenshot mode in tests', () => {
    expect(isScreenshotMode()).toBe(false);
  });

  it('delays between 150 and 450 ms', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(mockDelayMs()).toBe(150);
    vi.spyOn(Math, 'random').mockReturnValue(0.9999);
    expect(mockDelayMs()).toBe(450);
  });

  it('fails only GET list requests, about 3% of the time', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(shouldFail('GET', '/api/orders')).toBe(true);
    expect(shouldFail('GET', '/api/products')).toBe(true);
    expect(shouldFail('GET', '/api/orders/ord_000001')).toBe(false);
    expect(shouldFail('POST', '/api/orders')).toBe(false);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(shouldFail('GET', '/api/customers')).toBe(false);
  });
});
