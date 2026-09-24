import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../../models';

const NETWORK_MESSAGE = 'Network error. Check your connection.';
const GENERIC_MESSAGE = 'Something went wrong';

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
