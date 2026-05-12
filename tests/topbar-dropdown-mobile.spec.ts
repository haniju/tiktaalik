import { test, expect, devices } from '@playwright/test';

// Tests mobile — dropdown fermeture sur tap outside
// Vérifie que le tap ne traverse pas vers le canvas
test.use({ ...devices['Pixel 5'], hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByText('+ Nouveau').tap();
  await page.waitForSelector('.konvajs-content', { timeout: 5000 });
});

test('dropdown closes on tap outside (touch)', async ({ page }) => {
  await page.locator('img[alt="burger"]').tap();
  await expect(page.locator('text=Exporter en SVG')).toBeVisible();

  // Tap sur l'overlay (pas directement sur le canvas, l'overlay est devant)
  await page.touchscreen.tap(150, 400);

  await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();
});

test('tap outside dropdown does not create a stroke (touch)', async ({ page }) => {
  const canvasBefore = await page.locator('.konvajs-content canvas').screenshot();

  await page.locator('img[alt="burger"]').tap();
  await expect(page.locator('text=Exporter en SVG')).toBeVisible();
  await page.touchscreen.tap(150, 400);
  await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();

  await page.waitForTimeout(200);

  const canvasAfter = await page.locator('.konvajs-content canvas').screenshot();
  expect(canvasBefore.equals(canvasAfter)).toBe(true);
});
