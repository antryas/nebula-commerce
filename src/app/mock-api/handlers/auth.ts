import { mockDb } from '../db';
import { MockRouter, bodyOf, fail, ok } from '../router';

const MIN_PASSWORD_LENGTH = 6;

export function registerAuthRoutes(r: MockRouter): void {
  r.add('POST', '/api/auth/login', (req) => {
    const { email, password } = bodyOf(req);
    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      password.length < MIN_PASSWORD_LENGTH
    ) {
      return fail(401, 'invalid_credentials', 'Invalid email or password');
    }
    return ok({ token: 'demo-token', user: mockDb.data.user });
  });
}
