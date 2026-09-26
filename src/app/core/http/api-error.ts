import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../../models';

const NETWORK_MESSAGE = 'Network error. Check your connection.';
const GENERIC_MESSAGE = 'Something went wrong';
const RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment and try again.';

/** Normalizes anything thrown by an HTTP call into the app-wide `ApiError` shape. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof HttpErrorResponse) {
    const body: unknown = e.error;
    if (hasCodeAndMessage(body)) {
      const status = typeof body['status'] === 'number' ? body['status'] : e.status;
      const error: ApiError = { status, code: body['code'], message: body['message'] };
      if (body['details'] !== undefined) error.details = body['details'];
      return error;
    }
    if (e.status === 0) return { status: 0, code: 'network', message: NETWORK_MESSAGE };
    if (e.status === 429) return { status: 429, code: 'rate_limited', message: RATE_LIMIT_MESSAGE };
    // ASP.NET Core problem details (`application/problem+json`), e.g. a 400 validation error.
    if (isProblemDetails(body)) {
      const error: ApiError = {
        status: e.status,
        code: e.status === 400 ? 'validation' : 'unknown',
        message: body.detail ?? body.title,
      };
      if (body.errors !== undefined) error.details = body.errors;
      return error;
    }
    return { status: e.status, code: 'unknown', message: GENERIC_MESSAGE };
  }
  if (isApiError(e)) return e;
  return { status: 0, code: 'unknown', message: GENERIC_MESSAGE };
}

export function isApiError(e: unknown): e is ApiError {
  return hasCodeAndMessage(e) && typeof e['status'] === 'number';
}

function hasCodeAndMessage(
  v: unknown,
): v is Record<string, unknown> & { code: string; message: string } {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r['code'] === 'string' && typeof r['message'] === 'string';
}

function isProblemDetails(v: unknown): v is { title: string; detail?: string; errors?: unknown } {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['title'] === 'string' && (r['detail'] === undefined || typeof r['detail'] === 'string')
  );
}
