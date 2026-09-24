import { TestBed } from '@angular/core/testing';
import { AuroraBackground } from './aurora-background';

describe('AuroraBackground', () => {
  it('renders three decorative blobs hidden from assistive tech', async () => {
    const fixture = TestBed.createComponent(AuroraBackground);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('.nb-aurora-blob').length).toBe(3);
  });
});
