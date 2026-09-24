import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Avatar, initials } from './avatar';

@Component({
  imports: [Avatar],
  template: `<nb-avatar [src]="src()" [name]="name()" [size]="40" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly src = signal<string | null>('https://example.test/a.png');
  readonly name = signal('Ada Lovelace');
}

describe('initials', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['grace brewster hopper', 'GH'],
    ['Cher', 'C'],
    ['  ', '?'],
  ])('%s → %s', (name, out) => expect(initials(name)).toBe(out));
});

describe('Avatar', () => {
  it('renders the image with alt text and size', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('nb-avatar') as HTMLElement;
    const img = host.querySelector('img') as HTMLImageElement;
    expect(img.alt).toBe('Ada Lovelace');
    expect(host.style.width).toBe('40px');
  });

  it('falls back to initials when the image fails and recovers on a new src', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('nb-avatar') as HTMLElement;
    host.querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(host.querySelector('img')).toBeNull();
    const fallback = host.querySelector('.nb-avatar__initials') as HTMLElement;
    expect(fallback.textContent?.trim()).toBe('AL');
    expect(fallback.getAttribute('role')).toBe('img');
    expect(fallback.getAttribute('aria-label')).toBe('Ada Lovelace');

    fixture.componentInstance.src.set('https://example.test/b.png');
    await fixture.whenStable();
    expect(host.querySelector('img')).not.toBeNull();
  });
});
