import { Signal, computed } from '@angular/core';
import { toApiError } from '../../core/http/api-error';
import { ApiError } from '../../models';

/**
 * Resources wrap non-Error failures (our `ApiError` objects) in an Error whose `cause`
 * holds the original; unwrap it back into the app-wide error shape.
 */
export function resourceError(res: { error(): Error | undefined }): Signal<ApiError | null> {
  return computed(() => {
    const e = res.error();
    if (!e) return null;
    return toApiError(e.cause ?? e);
  });
}
