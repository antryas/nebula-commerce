import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { User } from '../../models';
import { AuthApi } from '../api/auth-api';

const STORAGE_KEY = 'nebula.auth';

interface StoredSession {
  token: string;
  user: User;
}

/** Demo authentication: any email with a 6+ character password signs in. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly session = signal<StoredSession | null>(readSession());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  login(email: string, password: string): Observable<User> {
    return this.api.login(email, password).pipe(
      tap((res) => this.setSession({ token: res.token, user: res.user })),
      map((res) => res.user),
    );
  }

  logout(): void {
    this.setSession(null);
  }

  private setSession(session: StoredSession | null): void {
    this.session.set(session);
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable: the session just won't survive a reload */
    }
  }
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    const { token, user } = parsed as Record<string, unknown>;
    if (typeof token !== 'string' || !user || typeof user !== 'object') return null;
    const u = user as Partial<User>;
    if (typeof u.id !== 'string' || typeof u.email !== 'string') return null;
    return { token, user: user as User };
  } catch {
    return null;
  }
}
