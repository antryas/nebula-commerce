import { Page, expect, test } from '@playwright/test';

/** Remote placeholder images may fail to load offline; that is not an app error. */
const IGNORED_ERRORS = [/picsum\.photos/i, /pravatar\.cc/i, /Failed to load resource/i];

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = `${msg.text()} ${msg.location().url}`;
    if (!IGNORED_ERRORS.some((re) => re.test(text))) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** `?screenshot=1` turns off random mock failures and latency so the smoke run is stable. */
function visit(page: Page, path: string) {
  return page.goto(`${path}?screenshot=1`);
}

async function expectHeading(page: Page, text?: string | RegExp): Promise<void> {
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading.first()).toBeVisible();
  if (text) await expect(heading.first()).toContainText(text);
}

async function signIn(page: Page): Promise<void> {
  await visit(page, '/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  // The demo credentials are prefilled.
  await page.getByRole('button', { name: /^sign in/i }).click();
  await expect(page).toHaveURL(/\/overview/);
}

test.describe('smoke', () => {
  let errors: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors = trackConsoleErrors(page);
    await signIn(page);
  });

  test.afterEach(() => {
    expect(errors, 'console errors').toEqual([]);
  });

  test('every authenticated page renders', async ({ page }) => {
    await expectHeading(page, /Alex/);

    await visit(page, '/orders');
    await expectHeading(page, 'Orders');
    await page.locator('[data-order-row]').first().click();
    await expect(page).toHaveURL(/\/orders\/[^/?]+/);
    await expectHeading(page, 'Order');

    await visit(page, '/fulfillment');
    await expectHeading(page, 'Fulfillment');

    await visit(page, '/products');
    await expectHeading(page, 'Products');

    await visit(page, '/products/new');
    await expectHeading(page, 'New product');

    await visit(page, '/products');
    await page.locator('a[href*="/edit"]').first().click();
    await expect(page).toHaveURL(/\/products\/[^/]+\/edit/);
    await expectHeading(page, 'Edit product');

    await visit(page, '/customers');
    await expectHeading(page, 'Customers');
    await page.locator('a[href^="/customers/"]:visible').first().click();
    await expect(page).toHaveURL(/\/customers\/[^/?]+/);
    await expectHeading(page);

    await visit(page, '/analytics');
    await expectHeading(page, 'Analytics');

    await visit(page, '/settings');
    await expectHeading(page, 'Settings');
  });

  test('command palette navigates to orders', async ({ page }) => {
    await expectHeading(page);
    await page.keyboard.press('Control+K');
    const input = page.getByRole('combobox', { name: 'Search commands' });
    await expect(input).toBeFocused();
    await input.fill('orders');
    await expect(page.getByRole('option').first()).toContainText('Orders');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/orders(\?|$)/);
    await expectHeading(page, 'Orders');
  });

  test('AI assistant answers a suggested question', async ({ page }) => {
    await expectHeading(page);
    await page.getByRole('button', { name: 'Ask Nebula AI' }).click();
    const panel = page.getByRole('dialog', { name: 'Ask Nebula AI' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Recorded demo');
    await panel.getByRole('button', { name: 'What were my top 5 products this month?' }).click();
    const log = panel.getByRole('log');
    await expect(log).toContainText('Your top 5 products over the last 30 days');
    await expect(log).toContainText('Used: top products');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});
