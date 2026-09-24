import { ApiConfigService } from './api-config.service';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** Demo-only backend controls. */
@Injectable({ providedIn: 'root' })
export class DemoApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfigService);

  /** Restores the demo data set to its seeded state. */
  reset(): Observable<void> {
    return this.http.post<void>(`${this.config.baseUrl()}/demo/reset`, null);
  }
}
