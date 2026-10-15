import { test, expect } from '@playwright/test';

// Optional integration check: kept separate so a third-party outage cannot break CI.
test('live public API loads and reveals a joke', async ({ page }) => {
  test.skip(!process.env.LIVE_API_TEST, 'Set LIVE_API_TEST=1 to check the real external service.');
  await page.goto('/');
  const reveal = page.getByRole('button', { name: 'Reveal punchline' });
  await expect(reveal).toBeEnabled({ timeout: 15000 });
  await reveal.click();
  await expect(page.locator('#punchline')).not.toBeEmpty();
  await page.getByLabel('Programming', { exact: true }).check();
  await expect(page.locator('#joke-type')).toHaveText('PROGRAMMING', { timeout: 15000 });
  await expect(reveal).toBeEnabled();
});
