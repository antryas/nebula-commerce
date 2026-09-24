import { mockDb } from '../db';
import { applyListQuery, parseListQuery } from '../query';
import { MockRouter, notFound, ok } from '../router';

export function registerCustomerRoutes(r: MockRouter): void {
  r.add('GET', '/api/customers', (req) => {
    const q = parseListQuery(req.query);
    return ok(
      applyListQuery(
        mockDb.data.customers,
        { ...q, sort: q.sort ?? 'createdAt' },
        { searchFields: ['name', 'email', 'country'] },
      ),
    );
  });

  r.add('GET', '/api/customers/:id', (req) => {
    const customer = mockDb.data.customers.find((c) => c.id === req.params['id']);
    if (!customer) return notFound('Customer');
    const orders = mockDb.data.orders
      .filter((o) => o.customerId === customer.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({ customer, orders });
  });
}
