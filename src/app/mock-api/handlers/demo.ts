import { mockDb } from '../db';
import { MockRouter, ok } from '../router';

/** Demo utilities: `POST /api/demo/reset` restores the seeded database. */
export function registerDemoRoutes(r: MockRouter): void {
  r.add('POST', '/api/demo/reset', () => {
    mockDb.reset();
    return ok(null, 204);
  });
}
