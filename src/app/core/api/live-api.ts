import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Order } from '../../models';
import { SKIP_ERROR_TOAST } from '../http/error.interceptor';
import { ApiConfigService } from './api-config.service';

/** Demo-only endpoint: each call makes the backend "receive" one new order. */
@Injectable({ providedIn: 'root' })
export class LiveApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  /** Background call, so failures never raise an error toast. */
  tick(): Observable<Order> {
    return this.http.post<Order>(`${this.config.baseUrl()}/live/tick`, null, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
