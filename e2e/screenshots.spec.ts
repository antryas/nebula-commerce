import { Browser, BrowserContextOptions, Page, expect, test } from '@playwright/test';

/**
 * Captures the portfolio screenshots into `portfolio/screenshots/`.
 * Run with `npm run screenshots`. Data is deterministic: `?screenshot=1` disables mock
 * latency and random failures; the clock is pinned to the demo's "now". The AI shots are
 * the exception: they use the live .NET backend and a real model (see `openLivePage`).
 */

/**
 * `NO_EMAILS=1` writes a copy without any e-mail addresses to `portfolio/catalog/`:
 * marketplaces such as Upwork reject images that show contact details, even demo ones.
 */
const NO_EMAILS = !!process.env['NO_EMAILS'];
const OUT_DIR = NO_EMAILS ? 'portfolio/catalog' : 'portfolio/screenshots';
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
  /** Device scale factor for desktop viewports (mobile is always 2). */
  scale?: number;
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

/** Blanks every text node that holds an e-mail address, keeping the layout intact. */
async function hideEmails(page: Page): Promise<void> {
  await page.evaluate(() => {
    const email = /[\w.+-]+@[\w-]+\.[\w.]+/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (email.test(node.textContent ?? '')) {
        node.parentElement?.style.setProperty('visibility', 'hidden');
        node.parentElement?.setAttribute('data-nb-email-hidden', '');
      }
    }
    document.querySelectorAll<HTMLInputElement>('input, textarea').forEach((el) => {
      if (email.test(el.value)) {
        el.style.setProperty('color', 'transparent');
        el.setAttribute('data-nb-email-hidden', '');
      }
    });
  });
}

/** Undoes `hideEmails`. */
async function showEmails(page: Page): Promise<void> {
  await page.evaluate(() =>
    document.querySelectorAll<HTMLElement>('[data-nb-email-hidden]').forEach((el) => {
      el.style.removeProperty('visibility');
      el.style.removeProperty('color');
      el.removeAttribute('data-nb-email-hidden');
    }),
  );
}

async function shoot(page: Page, name: string, fullPage = false): Promise<void> {
  // No focus rings or hover states from earlier interactions.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.mouse.move(0, 0);
  if (NO_EMAILS) await hideEmails(page);
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

/**
 * The AI shots run against the live .NET backend (real model answers, not templates).
 * `ng serve` points the live mode at `localhost:5080`; those requests are proxied to the
 * public API, with CORS headers added for this origin. Each run spends 3 live AI calls of
 * the demo's small daily quota, so they write both folders at once and skip `NO_EMAILS`.
 */
const LIVE_DEV_ORIGIN = 'http://localhost:5080';
const LIVE_ORIGIN = 'https://api.antrias.site';
const LIVE_TIMEOUT = 120_000;

/** Hides chrome that only distracts in an AI close-up: the suggested-question strip. */
const AI_CAPTURE_CSS = `.nb-ai__chips { display: none !important; }`;

const AI_QUESTION = 'Which category earned the most this month, and what are its top products?';
const AI_QUESTION_MOBILE = 'How did revenue change this month, and which 3 products sold best?';
const AI_PRODUCT = 'Action Camera';
const AI_TONE = 'premium';

interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function openLivePage(browser: Browser, opts: ShotOptions = {}): Promise<Page> {
  const { mode = 'dark', viewport = { width: 1440, height: 900 } } = opts;
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: opts.mobile ? 2 : (opts.scale ?? 1),
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
    colorScheme: mode,
    reducedMotion: 'reduce',
    timezoneId: 'UTC',
    locale: 'en-US',
  });
  const origin = new URL(test.info().project.use.baseURL ?? 'http://localhost:4300').origin;
  const cors = {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
  await context.route(`${LIVE_DEV_ORIGIN}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const headers = { ...request.headers() };
    delete headers['origin'];
    const response = await route.fetch({
      url: request.url().replace(LIVE_DEV_ORIGIN, LIVE_ORIGIN),
      headers,
      timeout: LIVE_TIMEOUT,
    });
    await route.fulfill({ response, headers: { ...response.headers(), ...cors } });
  });
  const page = await context.newPage();
  // No pinned clock here: the live API issues and checks real JWT timestamps.
  await page.addInitScript((mode) => {
    localStorage.setItem('nebula.theme', JSON.stringify({ mode, accent: 'violet' }));
    localStorage.setItem('nebula.backend', 'live');
  }, mode);

  // Sign in with the demo account the login form is prefilled with.
  await page.goto('/login?screenshot=1');
  await page.locator('button.nb-submit').click();
  await expect(page).toHaveURL(/\/overview/, { timeout: 30_000 });
  await settle(page);
  await expect(page.locator('.nb-backend')).toHaveAttribute('data-status', 'online');
  return page;
}

/**
 * Opens "Ask Nebula AI", types `question` into the composer and waits for the model's
 * answer to render. The answer varies from run to run, so only the live badge and the
 * tools line are asserted; the text is logged for review.
 */
async function askLiveAi(page: Page, question: string): Promise<void> {
  await page.locator('button.nb-ask-ai').evaluate((el: HTMLElement) => el.click());
  const panel = page.getByRole('dialog', { name: 'Ask Nebula AI' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('.nb-ai__badge')).toHaveAttribute('data-mode', 'live');
  await panel.getByRole('textbox', { name: 'Ask a question' }).fill(question);
  await panel.getByRole('button', { name: 'Send question' }).click();
  await expect(panel.locator('.nb-ai__msg--user')).toHaveCount(1);
  await expect(panel.locator('.nb-ai__typing')).toHaveCount(0, { timeout: LIVE_TIMEOUT });
  const answer = panel.locator('.nb-ai__msg:not(.nb-ai__msg--user)').last();
  await expect(answer.locator('nb-markdown-lite')).toBeVisible();
  const quota = panel.locator('.nb-ai__quota');
  console.log(
    `[AI] badge: ${await panel.locator('.nb-ai__badge').innerText()}\n` +
      `[AI] quota: ${(await quota.count()) ? await quota.innerText() : '-'}\n` +
      `[AI] Q: ${question}\n[AI] A: ${await answer.innerText()}`,
  );
  await expect(answer.locator('.nb-ai__tools')).toBeVisible();
  await page.addStyleTag({ content: AI_CAPTURE_CSS });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  // Start the thread at the question, so both the question and the answer are in view.
  await panel.locator('.nb-ai__thread').evaluate((thread) => {
    const first = thread.querySelector<HTMLElement>('.nb-ai__msg');
    if (first) thread.scrollTop = first.offsetTop - 16;
  });
  await page.waitForTimeout(300);
}

/** Writes the capture to both folders: as is, then with e-mail addresses blanked. */
async function shootBoth(page: Page, name: string, clip?: Clip): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.mouse.move(0, 0);
  const options = { animations: 'disabled', caret: 'hide', clip } as const;
  await page.screenshot({ ...options, path: `portfolio/screenshots/${name}.png` });
  await hideEmails(page);
  await page.screenshot({ ...options, path: `portfolio/catalog/${name}.png` });
  await showEmails(page);
}

/** The AI panel plus `context` px of the dimmed page to its left, full viewport height. */
async function panelClip(page: Page, context: number): Promise<Clip> {
  const box = await page.getByRole('dialog', { name: 'Ask Nebula AI' }).boundingBox();
  const viewport = page.viewportSize()!;
  const x = Math.max(0, Math.floor(box!.x - context));
  return { x, y: 0, width: viewport.width - x, height: viewport.height };
}

test.describe('AI (live backend)', () => {
  test.skip(NO_EMAILS, 'The live AI shots write both folders in the normal run.');

  test('14 AI assistant (dark + light)', async ({ browser }) => {
    test.setTimeout(240_000);
    const page = await openLivePage(browser, { viewport: { width: 1280, height: 900 }, scale: 2 });
    await askLiveAi(page, AI_QUESTION);
    await shootBoth(page, '14-ai-assistant-dark', await panelClip(page, 12));
    // Same answer in the light theme: flip the theme instead of asking again.
    await page.locator('.nb-topbar__theme').evaluate((el: HTMLElement) => el.click());
    await page.waitForTimeout(800);
    await shootBoth(page, '14-ai-assistant-light', await panelClip(page, 12));
    await page.context().close();
  });

  test('15 AI product description (dark)', async ({ browser }) => {
    test.setTimeout(240_000);
    const page = await openLivePage(browser);
    await page.goto('/products?screenshot=1');
    await settle(page);
    await page.getByPlaceholder('Search by name or SKU').fill(AI_PRODUCT);
    await page.waitForLoadState('networkidle');
    await page.locator('a[href*="/edit"]').filter({ hasText: AI_PRODUCT }).first().click();
    await expect(page).toHaveURL(/\/products\/[^/]+\/edit/);
    await settle(page);

    const description = page.locator('#product-description');
    const before = await description.inputValue();
    const generate = page.getByRole('button', { name: /Generate with AI|Generating/ });
    await page.getByLabel('Description tone').selectOption(AI_TONE);
    await generate.click();
    await expect(generate).toHaveText(/Generate with AI/, { timeout: LIVE_TIMEOUT });
    await expect(description).not.toHaveValue(before);
    await expect(page.locator('.nb-ai-gen__badge')).toHaveText('Live AI');
    console.log(`[AI] ${AI_PRODUCT} (${AI_TONE}): ${await description.inputValue()}`);
    await page.locator('.nb-ai-gen').scrollIntoViewIfNeeded();
    await goLive(page);
    await page.waitForTimeout(500);
    await shootBoth(page, '15-ai-product-description-dark');
    await page.context().close();
  });

  test('16 AI assistant mobile (dark)', async ({ browser }) => {
    test.setTimeout(240_000);
    const page = await openLivePage(browser, {
      viewport: { width: 390, height: 844 },
      mobile: true,
    });
    await askLiveAi(page, AI_QUESTION_MOBILE);
    await shootBoth(page, '16-ai-assistant-mobile');
    await page.context().close();
  });
});
