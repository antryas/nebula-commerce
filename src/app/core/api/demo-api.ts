import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Demo-only backend controls. */
@Injectable({ providedIn: 'root' })
export class DemoApi {
  private readonly http = inject(HttpClient);

  /** Restores the demo data set to its seeded state. */
  reset(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/demo/reset`, null);
  }
}
