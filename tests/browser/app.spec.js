import { test, expect } from '@playwright/test';

const api = 'https://official-joke-api.appspot.com/**';
const joke = { id: 42, type: 'general', setup: 'Why did the bicycle fall over?', punchline: 'It was two tired.' };
async function mock(page, data = joke) {
  await page.route(api, route => route.fulfill({ json: data }));
}
test('reveals, saves, persists and removes a joke', async ({ page }, testInfo) => {
  await mock(page);
  await page.goto('/');
  await expect(page.locator('#setup')).toHaveText(joke.setup);
  await expect(page.locator('#punchline')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Save joke', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reveal punchline' }).click();
  await expect(page.locator('#punchline')).toHaveText(joke.punchline);
  await page.screenshot({ path: `test-results/design-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Save joke', exact: true }).click();
  await expect(page.locator('#saved-count')).toHaveText('1');
  await page.reload();
  await expect(page.locator('.saved-card')).toHaveCount(1);
  await page.getByRole('button', { name: /Remove saved joke/ }).click();
  await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#saved-count')).toHaveText('0');
});
test('category selection fetches the selected type and resets the reveal', async ({ page }) => {
  await mock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Reveal punchline' }).click();
  const request = page.waitForRequest('**/jokes/programming/random');
  await page.route('**/jokes/programming/random', route => route.fulfill({ json: [{ ...joke, id: 11, type: 'programming', setup: 'A programmer walks into a bar…' }] }));
  await page.getByLabel('Programming', { exact: true }).check();
  await request;
  await expect(page.locator('#setup')).toHaveText('A programmer walks into a bar…');
  await expect(page.locator('#punchline')).toBeHidden();
  await expect(page.locator('#joke-type')).toHaveText('PROGRAMMING');
});
test('failed initial request can be retried', async ({ page }) => {
  await page.route(api, route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await mock(page);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('#setup')).toHaveText(joke.setup);
  await expect(page.getByRole('alert')).toBeHidden();
});
test('failed next request retains the current joke', async ({ page }) => {
  await mock(page);
  await page.goto('/');
  await expect(page.locator('#setup')).toHaveText(joke.setup);
  await page.route(api, route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.getByRole('button', { name: 'Give me another' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('#setup')).toHaveText(joke.setup);
  await expect(page.getByRole('button', { name: 'Reveal punchline' })).toBeEnabled();
});
test('timeout leaves a working retry button', async ({ page }) => {
  await page.clock.install();
  await page.route(api, () => {});
  await page.goto('/');
  await page.clock.fastForward(11000);
  await expect(page.getByRole('alert')).toHaveText(/too long/);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
});
test('loading blocks duplicate requests and category changes', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route(api, async route => { await pending; await route.fulfill({ json: joke }); });
  await page.goto('/');
  await expect(page.locator('#next')).toBeDisabled();
  await expect(page.getByLabel('Programming', { exact: true })).toBeDisabled();
  release();
  await expect(page.locator('#next')).toBeEnabled();
});
test('renders API text safely and has no horizontal overflow', async ({ page }) => {
  await mock(page, { ...joke, setup: '<img src=x onerror=alert(1)>' + 'long'.repeat(80) });
  await page.goto('/');
  await expect(page.locator('#setup')).toContainText('<img');
  await expect(page.locator('#setup img')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('copy includes the punchline', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copied = text; } } });
  });
  await mock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Reveal punchline' }).click();
  await page.getByRole('button', { name: 'Copy joke' }).click();
  await expect.poll(() => page.evaluate(() => window.copied)).toBe(`${joke.setup}\n\n${joke.punchline}`);
  await expect(page.getByRole('status')).toContainText('copied');
});
test('storage failures do not prevent saving for the current visit', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Unavailable'); } }); });
  await mock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Reveal punchline' }).click();
  await page.getByRole('button', { name: 'Save joke', exact: true }).click();
  await expect(page.locator('#saved-count')).toHaveText('1');
  await expect(page.getByRole('status')).toContainText('storage is unavailable');
});
test('keyboard can reveal a joke', async ({ page }) => {
  await mock(page);
  await page.goto('/');
  const reveal = page.getByRole('button', { name: 'Reveal punchline' });
  await reveal.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#punchline')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save joke', exact: true })).toBeFocused();
});
test('native sharing passes the complete joke', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: async data => { window.shared = data; } });
  });
  await mock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Reveal punchline' }).click();
  await page.getByRole('button', { name: 'Share joke' }).click();
  await expect.poll(() => page.evaluate(() => window.shared?.text)).toBe(`${joke.setup}\n\n${joke.punchline}`);
});
test('sharing falls back to copying when native share is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copied = text; } } });
  });
  await mock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Reveal punchline' }).click();
  await page.getByRole('button', { name: 'Share joke' }).click();
  await expect.poll(() => page.evaluate(() => window.copied)).toContain(joke.punchline);
});
test('blocked clipboard gives a useful message', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Denied'); } } });
  });
  await mock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Reveal punchline' }).click();
  await page.getByRole('button', { name: 'Copy joke' }).click();
  await expect(page.getByRole('status')).toContainText('select the joke text');
});
test('malformed API response is recoverable', async ({ page }) => {
  await mock(page, { unexpected: true });
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
});
