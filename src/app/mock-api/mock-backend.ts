import { registerAiRoutes } from './handlers/ai';
import { registerAnalyticsRoutes } from './handlers/analytics';
import { registerAuthRoutes } from './handlers/auth';
import { registerCustomerRoutes } from './handlers/customers';
import { registerDemoRoutes } from './handlers/demo';
import { registerOrderRoutes } from './handlers/orders';
import { registerProductRoutes } from './handlers/products';
import { registerLiveRoutes } from './live-orders';
import { MockRequest, MockResponse, MockRouter, fail } from './router';

/**
 * The heavy half of the mock API: seeded database (faker) + router + handlers.
 * Loaded lazily by the interceptor so none of it lands in the initial bundle.
 */
export const mockRouter = new MockRouter();
registerAuthRoutes(mockRouter);
registerOrderRoutes(mockRouter);
registerProductRoutes(mockRouter);
registerCustomerRoutes(mockRouter);
registerAnalyticsRoutes(mockRouter);
registerLiveRoutes(mockRouter);
registerDemoRoutes(mockRouter);
registerAiRoutes(mockRouter);

/** Routes a request to its handler. Request and response bodies are deep-copied. */
export function handleMockRequest(req: Omit<MockRequest, 'params'>): MockResponse {
  const match = mockRouter.match(req.method, req.path);
  if (!match) return fail(404, 'not_found', `No mock route for ${req.method} ${req.path}`);
  try {
    const res = match.handler({
      ...req,
      params: match.params,
      body: req.body == null ? req.body : structuredClone(req.body),
    });
    return { status: res.status, body: res.body == null ? null : structuredClone(res.body) };
  } catch (e) {
    return fail(500, 'server_error', e instanceof Error ? e.message : 'Mock handler failed');
  }
}
