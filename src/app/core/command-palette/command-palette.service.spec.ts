import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CommandPaletteService } from './command-palette.service';

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
    // First open loads the palette chunk, which can be slow on a busy test runner.
    await vi.waitFor(
      () =>
        expect(document.querySelector('nb-command-palette input[type="search"]')).not.toBeNull(),
      { timeout: 5000 },
    );
    s.close();
    await vi.waitFor(() => expect(document.querySelector('nb-command-palette')).toBeNull());
  });
});
