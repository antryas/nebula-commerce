import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AiAnswer,
  AiAskRequest,
  AiDescription,
  AiDescriptionRequest,
  AiStatus,
} from '../../models';
import { SKIP_ERROR_TOAST } from '../http/error.interceptor';
import { ApiConfigService } from './api-config.service';

/**
 * AI endpoints. The live backend answers with a model while its daily quota lasts and with
 * recorded answers after that; the mock always answers in recorded mode.
 */
@Injectable({ providedIn: 'root' })
export class AiApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  private get base(): string {
    return `${this.config.baseUrl()}/ai`;
  }

  status(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${this.base}/status`);
  }

  /** `silent` suppresses the global error toast when the caller reports failures itself. */
  ask(body: AiAskRequest, opts: { silent?: boolean } = {}): Observable<AiAnswer> {
    return this.http.post<AiAnswer>(`${this.base}/ask`, body, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, opts.silent ?? false),
    });
  }

  productDescription(body: AiDescriptionRequest): Observable<AiDescription> {
    return this.http.post<AiDescription>(`${this.base}/product-description`, body);
  }
}
