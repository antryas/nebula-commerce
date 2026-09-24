import { Browser, BrowserContextOptions, Page, expect, test } from '@playwright/test';

/**
 * Captures the portfolio screenshots into `portfolio/screenshots/`.
 * Run with `npm run screenshots`. Data is deterministic: `?screenshot=1` disables mock
 * latency and random failures; the clock is pinned to the demo's "now".
 */

const OUT_DIR = 'portfolio/screenshots';
/** Seed "now" is 2026-09-24T12:00Z; a few minutes later keeps relative times fresh. */
const DEMO_TIME = new Date('2026-09-24T12:20:00Z');

const SESSION = {
  token: 'demo-token',
  user: {
    id: 'usr_1',
    name: 'Alex Morgan',
    email: 'alex@nebula.store',
    avatarUrl: 'https://i.pravatar.cc/80?u=alex',
    role: 'Admin',
  },
};

type Mode = 'dark' | 'light';

interface ShotOptions {
  mode?: Mode;
  signedIn?: boolean;
  viewport?: { width: number; height: number };
  mobile?: boolean;
}

/** Hides the toast stack and the text caret so nothing transient ends up in a capture. */
const CAPTURE_CSS = `
  nb-toast-host, .nb-toast-stack { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`;

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

async function openPage(browser: Browser, opts: ShotOptions = {}): Promise<Page> {
  const { mode = 'dark', signedIn = true, viewport = { width: 1440, height: 900 } } = opts;
  const contextOptions: BrowserContextOptions = {
    viewport,
    deviceScaleFactor: opts.mobile ? 2 : 1,
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
    colorScheme: mode,
    // Reduced motion renders the final frame at once: charts skip their intro animation,
    // KPI count-ups write the final value and staggered entrances are already settled.
    reducedMotion: 'reduce',
    timezoneId: 'UTC',
    locale: 'en-US',
  };
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.clock.install({ time: DEMO_TIME });
  await page.addInitScript(
    ({ session, mode }) => {
      localStorage.setItem('nebula.theme', JSON.stringify({ mode, accent: 'violet' }));
      if (session) localStorage.setItem('nebula.auth', JSON.stringify(session));
      else localStorage.removeItem('nebula.auth');
    },
    { session: signedIn ? SESSION : null, mode },
  );
  return page;
}

async function go(page: Page, path: string): Promise<void> {
  await page.goto(`${path}?screenshot=1`);
  await settle(page);
  if (await page.locator('button.nb-live').count()) await goLive(page);
}

/** Waits until fonts, images, charts and skeletons have all settled. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: CAPTURE_CSS });
  await expect(page.locator('nb-skeleton')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () =>
      // Off-screen `loading="lazy"` images never load, so only visible ones are awaited.
      Array.from(document.images).every((img) => {
        const r = img.getBoundingClientRect();
        const onScreen =
          r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
        return !onScreen || img.complete;
      }),
    undefined,
    { timeout: 20_000 },
  );
  // Every chart host must have drawn a non-empty canvas.
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('[echarts]')).every((host) => {
        const canvas = host.querySelector('canvas');
        return !!canvas && canvas.width > 0 && canvas.height > 0;
      }),
    undefined,
    { timeout: 20_000 },
  );
  // Let the last layout/paint (chart resize observers, view transitions) finish.
  await page.waitForTimeout(1500);
}

/**
 * Screenshot mode starts with the live feed paused; switch it on so the UI reads "Live".
 * Its first simulated order lands 6+ s later, well after the capture.
 */
async function goLive(page: Page): Promise<void> {
  const toggle = page.locator('button.nb-live');
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
    await toggle.evaluate((el: HTMLElement) => el.click());
  }
  await page.waitForTimeout(300);
}

async function shoot(page: Page, name: string, fullPage = false): Promise<void> {
  // No focus rings or hover states from earlier interactions.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.mouse.move(0, 0);
  if (fullPage) {
    // Grow the viewport to the content instead of Playwright's `fullPage`, so the
    // viewport-sized sidebar and background stretch with the page.
    const width = page.viewportSize()?.width ?? 1440;
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: `${OUT_DIR}/${name}.png`,
    animations: 'disabled',
    caret: 'hide',
  });
}

test('01 overview (dark)', async ({ browser }) => {
  const page = await openPage(browser);
  await go(page, '/overview');
  await shoot(page, '01-overview-dark');
  await page.context().close();
});

test('cover: overview (dark, 1600x1200)', async ({ browser }) => {
  const page = await openPage(browser, { viewport: { width: 1600, height: 1200 } });
  await go(page, '/overview');
  await shoot(page, 'cover');
  await page.context().close();
});

test('02 orders + 03 order details (dark)', async ({ browser }) => {
  const page = await openPage(browser);
  await go(page, '/orders');
  await shoot(page, '02-orders-dark');

  // A shipped multi-item order shows a fuller item list and status timeline.
  await page.getByRole('button', { name: 'Shipped' }).click();
  await page.waitForLoadState('networkidle');
  await page
    .locator('[data-order-row]')
    .filter({ has: page.locator('td', { hasText: /^\s*[3-9]\s*$/ }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/orders\/[^/?]+/);
  await settle(page);
  await shoot(page, '03-order-details-dark');
  await page.context().close();
});

test('04 fulfillment (dark)', async ({ browser }) => {
  const page = await openPage(browser);
  await go(page, '/fulfillment');
  await shoot(page, '04-fulfillment-dark');
  await page.context().close();
});

test('05 products grid + 06 product edit (dark)', async ({ browser }) => {
  const page = await openPage(browser);
  await go(page, '/products');
  await shoot(page, '05-products-grid-dark');

  // A published product with a photogenic image.
  await page.getByPlaceholder('Search by name or SKU').fill('Action Camera');
  await page.waitForLoadState('networkidle');
  await page.locator('a[href*="/edit"]').filter({ hasText: 'Action Camera' }).first().click();
  await expect(page).toHaveURL(/\/products\/[^/]+\/edit/);
  await settle(page);
  // Full page: the whole form is visible and the sticky save bar sits clear at the bottom.
  await shoot(page, '06-product-edit-dark', true);
  await page.context().close();
});

test('07 analytics (dark)', async ({ browser }) => {
  const page = await openPage(browser);
  await go(page, '/analytics');
  await shoot(page, '07-analytics-dark', true);
  await page.context().close();
});

test('08 customers (dark)', async ({ browser }) => {
  const page = await openPage(browser);
  await go(page, '/customers');
  await shoot(page, '08-customers-dark');
  await page.context().close();
});

test('09 login (dark)', async ({ browser }) => {
  const page = await openPage(browser, { signedIn: false });
  await go(page, '/login');
  await shoot(page, '09-login-dark');
  await page.context().close();
});

test('10 overview (light)', async ({ browser }) => {
  const page = await openPage(browser, { mode: 'light' });
  await go(page, '/overview');
  await shoot(page, '10-overview-light');
  await page.context().close();
});

test('11 command palette (dark)', async ({ browser }) => {
  const page = await openPage(browser);
  await go(page, '/overview');
  await page.keyboard.press('Control+K');
  const input = page.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeFocused();
  await input.pressSequentially('nova', { delay: 60 });
  // Entity results arrive after the search debounce.
  await expect(
    page.locator('[role="group"][aria-label="Products"] [role="option"]').first(),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await shoot(page, '11-command-palette-dark');
  await page.context().close();
});

test('12 + 13 mobile overview and orders (dark)', async ({ browser }) => {
  const page = await openPage(browser, { viewport: { width: 390, height: 844 }, mobile: true });
  await go(page, '/overview');
  await shoot(page, '12-mobile-overview');
  await go(page, '/orders');
  await shoot(page, '13-mobile-orders');
  await page.context().close();
});
