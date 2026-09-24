import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiConfigService, BackendMode } from '../api/api-config.service';
import { AuthService } from '../auth/auth.service';
import { LiveOrdersService } from '../live/live-orders.service';
import { Sidebar } from './sidebar';

async function setup(initial: BackendMode) {
  const mode = signal<BackendMode>(initial);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ApiConfigService, useValue: { mode } },
      { provide: AuthService, useValue: { user: signal(null) } },
      { provide: LiveOrdersService, useValue: { count: signal(0) } },
    ],
  });
  const fixture = TestBed.createComponent(Sidebar);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const promo = () =>
    el.querySelector('.nb-sidebar__promo')?.textContent?.replace(/\s+/g, ' ').trim();
  return { fixture, mode, promo };
}

describe('Sidebar', () => {
  it('describes the mock backend in the demo note', async () => {
    const { promo } = await setup('mock');
    expect(promo()).toContain('Mock API with real-time orders');
  });

  it('follows a switch to the live .NET backend', async () => {
    const { fixture, mode, promo } = await setup('mock');
    mode.set('live');
    await fixture.whenStable();
    expect(promo()).toContain('Live .NET API with real-time orders');
    expect(promo()).not.toContain('Mock API');
  });
});
