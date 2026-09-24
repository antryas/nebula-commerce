import { ApiError } from '../models';

export interface MockRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

export type MockHandler = (req: MockRequest) => MockResponse;

interface Route {
  method: string;
  segments: string[];
  handler: MockHandler;
}

/** Minimal method + path router supporting `:name` segments, e.g. `/api/orders/:id`. */
export class MockRouter {
  private readonly routes: Route[] = [];

  add(method: string, pattern: string, handler: MockHandler): this {
    this.routes.push({ method: method.toUpperCase(), segments: split(pattern), handler });
    return this;
  }

  match(
    method: string,
    path: string,
  ): { handler: MockHandler; params: Record<string, string> } | null {
    const upper = method.toUpperCase();
    const parts = split(path);
    for (const route of this.routes) {
      if (route.method !== upper || route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      const matched = route.segments.every((seg, i) => {
        if (seg.startsWith(':')) {
          params[seg.slice(1)] = safeDecode(parts[i]);
          return true;
        }
        return seg === parts[i];
      });
      if (matched) return { handler: route.handler, params };
    }
    return null;
  }
}

export function ok(body: unknown, status = 200): MockResponse {
  return { status, body };
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): MockResponse {
  const body: ApiError = { status, code, message };
  if (details !== undefined) body.details = details;
  return { status, body };
}

export function notFound(what = 'Resource'): MockResponse {
  return fail(404, 'not_found', `${what} not found`);
}

/** Narrows an unknown request body to a plain object (empty object when it is not one). */
export function bodyOf(req: MockRequest): Record<string, unknown> {
  const b = req.body;
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
}

function split(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
