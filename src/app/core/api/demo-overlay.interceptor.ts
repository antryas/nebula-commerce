import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { ApiError, Order, OrderStatus, Paged, Product } from '../../models';
import { ApiConfigService } from './api-config.service';
import type { CustomerProfile } from './customers-api';
import { DRY_RUN_HEADER, DemoOverlay } from './demo-overlay';

/**
 * Live mode only: records writes that a read-only backend answered as a dry run
 * (`X-Nebula-Dry-Run: true`) in `DemoOverlay`, and lays those changes over list and detail
 * reads, so the visitor's edits stick for the tab. Products created in this tab never exist
 * on the server, so their reads, updates and deletes are answered here. Mock mode is untouched.
 */
export const demoOverlayInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(ApiConfigService);
  if (config.mode() !== 'live' || !config.isApiUrl(req.url)) return next(req);

  const overlay = inject(DemoOverlay);
  const url = new URL(req.urlWithParams, 'http://api.local');
  const base = new URL(config.baseUrl(), 'http://api.local').pathname.replace(/\/$/, '');
  const [resource, id, action, ...rest] = url.pathname
    .slice(base.length)
    .split('/')
    .filter(Boolean)
    .map(safeDecode);
  if (rest.length) return next(req);

  if (req.method === 'GET') {
    return reads(req, next, overlay, url.searchParams, resource, id, action);
  }
  return writes(req, next, overlay, config.baseUrl(), resource, id, action);
};

type Next = (req: HttpRequest<unknown>) => Observable<HttpEvent<unknown>>;

function reads(
  req: HttpRequest<unknown>,
  next: Next,
  overlay: DemoOverlay,
  query: URLSearchParams,
  resource: string | undefined,
  id: string | undefined,
  action: string | undefined,
): Observable<HttpEvent<unknown>> {
  if (action) return next(req);

  if (resource === 'products' && id) {
    const local = overlay.localProduct(id);
    if (local) return of(new HttpResponse({ status: 200, body: local, url: req.urlWithParams }));
    if (overlay.isDeletedProduct(id)) return throwError(() => notFound(req, 'Product'));
    return mapBody<Product>(next(req), (p) => {
      overlay.rememberProducts([p]);
      return overlay.applyProduct(p);
    });
  }
  if (resource === 'products') {
    return mapBody<Paged<Product>>(next(req), (page) => {
      overlay.rememberProducts(page.items);
      return overlay.applyProducts(page, query);
    });
  }
  if (resource === 'orders' && id) {
    return mapBody<Order>(next(req), (o) => {
      overlay.rememberOrders([o]);
      return overlay.applyOrder(o);
    });
  }
  if (resource === 'orders') {
    return mapBody<Paged<Order>>(next(req), (page) => {
      overlay.rememberOrders(page.items);
      return overlay.applyOrders(page, query);
    });
  }
  if (resource === 'customers' && id) {
    return mapBody<CustomerProfile>(next(req), (profile) => {
      overlay.rememberOrders(profile.orders);
      return overlay.applyCustomerProfile(profile);
    });
  }
  if (resource === 'analytics' && id === 'top-products') {
    return mapBody<{ product: Product }[]>(next(req), (rows) => overlay.applyTopProducts(rows));
  }
  return next(req);
}

function writes(
  req: HttpRequest<unknown>,
  next: Next,
  overlay: DemoOverlay,
  baseUrl: string,
  resource: string | undefined,
  id: string | undefined,
  action: string | undefined,
): Observable<HttpEvent<unknown>> {
  // A product created in this tab: validate an edit as a create, delete it locally.
  const local = resource === 'products' && id && !action ? overlay.localProduct(id) : null;
  if (local && req.method === 'DELETE') {
    overlay.deleteProduct(local.id);
    return of(new HttpResponse({ status: 204, body: null, url: req.urlWithParams }));
  }
  if (local && req.method === 'PUT') {
    const asCreate = req.clone({ method: 'POST', url: `${baseUrl}/products` });
    return onDryRun<Product>(next(asCreate), overlay, (p) =>
      overlay.saveProduct(p, { localId: local.id }),
    );
  }

  if (resource === 'products' && !action) {
    if (req.method === 'POST' && !id) {
      return onDryRun<Product>(next(req), overlay, (p) =>
        overlay.saveProduct(p, { created: true }),
      );
    }
    if (req.method === 'PUT' && id) {
      return onDryRun<Product>(next(req), overlay, (p) => overlay.saveProduct(p));
    }
    if (req.method === 'DELETE' && id) {
      return onDryRun<unknown>(next(req), overlay, (body) => {
        overlay.deleteProduct(id);
        return body;
      });
    }
  }
  if (resource === 'orders' && req.method === 'PATCH' && id && action === 'status') {
    return onDryRun<Order>(next(req), overlay, (o) => {
      overlay.saveOrder(o);
      return o;
    });
  }
  if (resource === 'orders' && req.method === 'POST' && id === 'bulk-status' && !action) {
    const { ids, status } = (req.body ?? {}) as { ids?: string[]; status?: OrderStatus };
    return onDryRun<unknown>(next(req), overlay, (body) => {
      if (Array.isArray(ids) && status) overlay.bulkStatus(ids, status);
      return body;
    });
  }
  // A reset that saved nothing still means "start over": drop the visitor's changes.
  if (resource === 'demo' && req.method === 'POST' && id === 'reset' && !action) {
    return onDryRun<unknown>(next(req), overlay, (body) => {
      overlay.clear();
      return body;
    });
  }
  // Live orders (`/live/tick`) are the backend's own feed, not a visitor's change.
  return next(req);
}

/** Applies `fn` to the body of a successful dry-run response; other responses pass as is. */
function onDryRun<T>(
  events: Observable<HttpEvent<unknown>>,
  overlay: DemoOverlay,
  fn: (body: T) => unknown,
): Observable<HttpEvent<unknown>> {
  return events.pipe(
    map((event) => {
      if (!(event instanceof HttpResponse) || !isDryRun(event)) return event;
      overlay.markReadOnly();
      return event.clone({ body: fn(event.body as T) });
    }),
  );
}

function mapBody<T>(
  events: Observable<HttpEvent<unknown>>,
  fn: (body: T) => unknown,
): Observable<HttpEvent<unknown>> {
  return events.pipe(
    map((event) =>
      event instanceof HttpResponse && event.body != null
        ? event.clone({ body: fn(event.body as T) })
        : event,
    ),
  );
}

export function isDryRun(res: HttpResponse<unknown>): boolean {
  return res.headers.get(DRY_RUN_HEADER)?.trim().toLowerCase() === 'true';
}

function notFound(req: HttpRequest<unknown>, what: string): HttpErrorResponse {
  const error: ApiError = { status: 404, code: 'not_found', message: `${what} not found` };
  return new HttpErrorResponse({ status: 404, statusText: 'Not Found', error, url: req.url });
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
