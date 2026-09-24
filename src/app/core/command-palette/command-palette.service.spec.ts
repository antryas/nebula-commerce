import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CommandPaletteService } from './command-palette.service';
// Load the lazy palette chunk with the spec file so opening it in a test is fast even on a
// busy runner (the service's dynamic import then resolves to this already-loaded module).
import './command-palette';

describe('CommandPaletteService', () => {
  let s: CommandPaletteService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    s = TestBed.inject(CommandPaletteService);
  });

  afterEach(() => s.close());

  it('starts closed', () => expect(s.isOpen()).toBe(false));

  it('open() sets isOpen true', () => {
    s.open();
    expect(s.isOpen()).toBe(true);
  });

  it('toggle() twice returns to closed', () => {
    s.toggle();
    expect(s.isOpen()).toBe(true);
    s.toggle();
    expect(s.isOpen()).toBe(false);
  });

  it('close() is idempotent', () => {
    s.close();
    s.close();
    expect(s.isOpen()).toBe(false);
  });

  it('renders the palette into an overlay once opened', async () => {
    s.open();
    await vi.waitFor(
      () =>
        expect(document.querySelector('nb-command-palette input[type="search"]')).not.toBeNull(),
      { timeout: 3000 },
    );
    s.close();
    await vi.waitFor(() => expect(document.querySelector('nb-command-palette')).toBeNull());
  });

  it('preload() fetches the palette chunk once', async () => {
    const first = s.preload();
    expect(s.preload()).toBe(first);
    await expect(first).resolves.toHaveProperty('attachCommandPalette');
  });

  it('keeps keys typed before the palette mounts as the initial query', async () => {
    s.open();
    const press = (key: string) =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    ['o', 'r', 'x', 'Backspace', 'd'].forEach(press);
    let input: HTMLInputElement | null = null;
    await vi.waitFor(
      () => {
        input = document.querySelector<HTMLInputElement>('nb-command-palette input[type="search"]');
        expect(input).not.toBeNull();
      },
      { timeout: 3000 },
    );
    expect(input!.value).toBe('ord');
    // Once mounted, typing goes to the input itself; the buffer no longer swallows keys.
    const late = new KeyboardEvent('keydown', { key: 'z', cancelable: true });
    document.dispatchEvent(late);
    expect(late.defaultPrevented).toBe(false);
  });
});
