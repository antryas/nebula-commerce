import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order } from '../../models';
import { SKIP_ERROR_TOAST } from '../http/error.interceptor';

/** Demo-only endpoint: each call makes the backend "receive" one new order. */
@Injectable({ providedIn: 'root' })
export class LiveApi {
  private readonly http = inject(HttpClient);

  /** Background call, so failures never raise an error toast. */
  tick(): Observable<Order> {
    return this.http.post<Order>(`${environment.apiUrl}/live/tick`, null, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
