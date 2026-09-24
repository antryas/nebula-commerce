import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../models';
import { Login } from './login';

const USER = { id: 'usr_1', name: 'Alex Morgan', email: 'alex@nebula.store' } as User;

async function setup(login = vi.fn().mockReturnValue(of(USER))) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: { login } }],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Login);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const input = (name: string) => el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const type = async (name: string, value: string) => {
    input(name).value = value;
    input(name).dispatchEvent(new Event('input'));
    input(name).dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { fixture, el, input, type, submit, login, navigate };
}

describe('Login', () => {
  it('is prefilled with the demo credentials and valid', async () => {
    const { input, el } = await setup();
    expect(input('email').value).toBe('alex@nebula.store');
    expect(input('password').value).toBe('demo1234');
    expect(el.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(false);
    expect(el.textContent).not.toContain('Enter a valid email');
  });

  it('shows a validation message for an invalid email', async () => {
    const { type, el, input } = await setup();
    await type('email', 'not-an-email');
    expect(el.textContent).toContain('Enter a valid email');
    expect(input('email').getAttribute('aria-invalid')).toBe('true');
  });

  it('requires a password of at least 6 characters and does not submit', async () => {
    const { type, submit, el, login } = await setup();
    await type('password', '123');
    await submit();
    expect(el.textContent).toContain('At least 6 characters');
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in and navigates to /overview', async () => {
    const { submit, login, navigate } = await setup();
    await submit();
    expect(login).toHaveBeenCalledWith('alex@nebula.store', 'demo1234');
    expect(navigate).toHaveBeenCalledWith('/overview');
  });

  it('navigates to a safe returnUrl', async () => {
    const { fixture, submit, navigate } = await setup();
    fixture.componentRef.setInput('returnUrl', '/orders?status=new');
    await submit();
    expect(navigate).toHaveBeenCalledWith('/orders?status=new');
  });

  it('ignores an external returnUrl', async () => {
    const { fixture, submit, navigate } = await setup();
    fixture.componentRef.setInput('returnUrl', '//evil.example');
    await submit();
    expect(navigate).toHaveBeenCalledWith('/overview');
  });

  it('shows the server error when sign-in fails', async () => {
    const login = vi.fn().mockReturnValue(
      throwError(() => ({
        status: 401,
        code: 'invalid_credentials',
        message: 'Invalid email or password',
      })),
    );
    const { submit, el, navigate } = await setup(login);
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Invalid email or password');
    expect(navigate).not.toHaveBeenCalled();
  });
});
