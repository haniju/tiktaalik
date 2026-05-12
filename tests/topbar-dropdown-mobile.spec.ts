import { test, expect, devices } from '@playwright/test';

// Test mobile — le bug constaté est que le tap touch sur le canvas
// ne ferme pas le dropdown (mousedown synthétique bloqué par Konva)
test.use({ ...devices['Pixel 5'], hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByText('+ Nouveau').tap();
  await page.waitForSelector('.konvajs-content', { timeout: 5000 });
});

test('dropdown closes on tap outside (touch)', async ({ page }) => {
  // Ouvrir le dropdown
  await page.locator('img[alt="burger"]').tap();
  await expect(page.locator('text=Exporter en SVG')).toBeVisible();

  // Tap touch sur le canvas (simule un vrai tap mobile)
  const canvas = page.locator('.konvajs-content');
  await canvas.tap({ position: { x: 150, y: 300 } });

  // Le dropdown doit se fermer
  await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();
});
