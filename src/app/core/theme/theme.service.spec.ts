import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    delete document.documentElement.dataset['accent'];
    TestBed.configureTestingModule({});
  });

  it('defaults to dark mode and violet accent', () => {
    const s = TestBed.inject(ThemeService);
    expect(s.mode()).toBe('dark');
    expect(s.accent()).toBe('violet');
  });

  it('toggles mode and applies class to <html>', () => {
    const s = TestBed.inject(ThemeService);
    s.toggleMode();
    TestBed.tick();
    expect(s.mode()).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setMode sets the requested mode', () => {
    const s = TestBed.inject(ThemeService);
    s.setMode('light');
    s.setMode('dark');
    TestBed.tick();
    expect(s.mode()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists and restores settings', () => {
    TestBed.inject(ThemeService).setAccent('rose');
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('nebula.theme') ?? 'null')).toEqual({
      mode: 'dark',
      accent: 'rose',
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(ThemeService).accent()).toBe('rose');
  });

  it('ignores corrupted or invalid stored values', () => {
    localStorage.setItem('nebula.theme', '{"mode":"neon","accent":42');
    let s = TestBed.inject(ThemeService);
    expect(s.mode()).toBe('dark');
    expect(s.accent()).toBe('violet');

    localStorage.setItem('nebula.theme', JSON.stringify({ mode: 'neon', accent: 'teal' }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    s = TestBed.inject(ThemeService);
    expect(s.mode()).toBe('dark');
    expect(s.accent()).toBe('violet');
  });

  it('sets data-accent attribute', () => {
    const s = TestBed.inject(ThemeService);
    s.setAccent('cyan');
    TestBed.tick();
    expect(document.documentElement.dataset['accent']).toBe('cyan');
  });

  it('exposes reducedMotion as a boolean signal', () => {
    const s = TestBed.inject(ThemeService);
    expect(typeof s.reducedMotion()).toBe('boolean');
  });
});
