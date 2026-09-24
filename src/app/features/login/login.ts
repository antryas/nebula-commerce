import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { isApiError } from '../../core/http/api-error';
import { LoginArt } from './login-art';

const DEFAULT_REDIRECT = '/overview';
const DEMO_EMAIL = 'alex@nebula.store';
const DEMO_PASSWORD = 'demo1234';

type Field = 'email' | 'password';

/** Only same-app absolute paths are accepted as a post-login destination. */
function safeRedirect(url: string | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return DEFAULT_REDIRECT;
  }
  return url;
}

@Component({
  selector: 'nb-login-page',
  imports: [LoginArt, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** `?returnUrl=` query param, bound via `withComponentInputBinding()`. */
  readonly returnUrl = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: [DEMO_EMAIL, [Validators.required, Validators.email]],
    password: [DEMO_PASSWORD, [Validators.required, Validators.minLength(6)]],
    remember: [true],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);

  protected errorFor(field: Field): string | null {
    const control = this.form.controls[field];
    if (control.valid || !(control.touched || this.submitted())) return null;
    if (field === 'email') {
      return control.hasError('required') ? 'Email is required' : 'Enter a valid email';
    }
    return control.hasError('required') ? 'Password is required' : 'At least 6 characters';
  }

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.auth.login(email.trim(), password).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl(safeRedirect(this.returnUrl()));
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.error.set(isApiError(e) ? e.message : 'Sign-in failed. Please try again.');
      },
    });
  }
}
