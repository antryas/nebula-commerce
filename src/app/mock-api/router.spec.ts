import { MockRouter, ok } from './router';

describe('MockRouter', () => {
  const list = () => ok('list');
  const one = () => ok('one');
  const status = () => ok('status');
  const router = new MockRouter()
    .add('GET', '/api/orders', list)
    .add('GET', '/api/orders/:id', one)
    .add('PATCH', '/api/orders/:id/status', status);

  it('matches static paths', () => {
    expect(router.match('GET', '/api/orders')?.handler).toBe(list);
  });

  it('extracts named params', () => {
    const m = router.match('PATCH', '/api/orders/ord_000001/status');
    expect(m?.handler).toBe(status);
    expect(m?.params).toEqual({ id: 'ord_000001' });
  });

  it('decodes params and ignores trailing slashes', () => {
    expect(router.match('GET', '/api/orders/a%20b/')?.params).toEqual({ id: 'a b' });
  });

  it('respects the HTTP method', () => {
    expect(router.match('DELETE', '/api/orders/1')).toBeNull();
    expect(router.match('get', '/api/orders/1')?.handler).toBe(one);
  });

  it('returns null for unknown paths', () => {
    expect(router.match('GET', '/api/nope')).toBeNull();
    expect(router.match('GET', '/api/orders/1/2/3')).toBeNull();
  });
});
