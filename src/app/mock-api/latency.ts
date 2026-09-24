const SCREENSHOT_MODE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('screenshot');

const LIST_PATH = /^\/api\/(orders|products|customers)$/;
const FAILURE_RATE = 0.03;

/** True when the app was opened with `?screenshot=1` (no latency, no random failures). */
export function isScreenshotMode(): boolean {
  return SCREENSHOT_MODE;
}

/** Simulated network latency: 150-450 ms, or 0 in screenshot mode. */
export function mockDelayMs(): number {
  return isScreenshotMode() ? 0 : 150 + Math.floor(Math.random() * 301);
}

/** ~3% of GET list requests fail with a simulated 500, never in screenshot mode. */
export function shouldFail(method: string, path: string): boolean {
  return (
    !isScreenshotMode() &&
    method.toUpperCase() === 'GET' &&
    LIST_PATH.test(path) &&
    Math.random() < FAILURE_RATE
  );
}
