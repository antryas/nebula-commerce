import { HttpParams } from '@angular/common/http';

export type QueryValue = string | number | undefined | null | readonly string[];

/**
 * Builds `HttpParams` from a flat query object. Empty values (`undefined`, `null`, `''`,
 * empty arrays) are skipped; arrays are sent as one comma-separated value.
 */
export function toHttpParams(q: Readonly<Record<string, QueryValue>>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(q)) {
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params = params.set(key, value.join(','));
      continue;
    }
    params = params.set(key, String(value));
  }
  return params;
}
