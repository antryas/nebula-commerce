import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService } from './core/auth/auth.service';
import { CommandPaletteService } from './core/command-palette/command-palette.service';

function setup(authenticated: boolean) {
  const palette = { toggle: vi.fn(), close: vi.fn(), isOpen: signal(false) };
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isAuthenticated: signal(authenticated) } },
      { provide: CommandPaletteService, useValue: palette },
    ],
  });
  const fixture = TestBed.createComponent(App);
  return { fixture, palette, el: fixture.nativeElement as HTMLElement };
}

const ctrlK = (init: KeyboardEventInit = { ctrlKey: true }) =>
  new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true, ...init });

describe('App', () => {
  it('renders the aurora background and router outlet', async () => {
    const { fixture, el } = setup(true);
    await fixture.whenStable();
    expect(el.querySelector('nb-aurora-background')).not.toBeNull();
    expect(el.querySelector('router-outlet')).not.toBeNull();
  });

  it('mounts the global toast host lazily', async () => {
    const { fixture } = setup(true);
    await fixture.whenStable();
    await vi.waitFor(() => expect(document.querySelector('nb-toast-host')).not.toBeNull(), {
      timeout: 5000,
    });
    fixture.destroy();
    expect(document.querySelector('nb-toast-host')).toBeNull();
  });

  it('toggles the command palette on Ctrl+K and Cmd+K when signed in', async () => {
    const { fixture, palette } = setup(true);
    await fixture.whenStable();
    const e = ctrlK();
    document.dispatchEvent(e);
    document.dispatchEvent(ctrlK({ metaKey: true }));
    expect(palette.toggle).toHaveBeenCalledTimes(2);
    expect(e.defaultPrevented).toBe(true);
  });

  it('ignores Ctrl+K while signed out and plain K presses', async () => {
    const { fixture, palette } = setup(false);
    await fixture.whenStable();
    document.dispatchEvent(ctrlK());
    document.dispatchEvent(ctrlK({ ctrlKey: false }));
    expect(palette.toggle).not.toHaveBeenCalled();
  });
});
