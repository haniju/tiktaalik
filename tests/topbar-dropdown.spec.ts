import { test, expect } from '@playwright/test';

test.describe('Topbar dropdown menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('text=+ Nouveau');
    await page.waitForSelector('.konvajs-content', { timeout: 5000 });
  });

  test('dropdown opens on burger click', async ({ page }) => {
    await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();
    await page.locator('img[alt="burger"]').click();
    await expect(page.locator('text=Exporter en SVG')).toBeVisible();
  });

  test('dropdown closes on click outside', async ({ page }) => {
    await page.locator('img[alt="burger"]').click();
    await expect(page.locator('text=Exporter en SVG')).toBeVisible();

    // Cliquer sur l'overlay (couvre tout l'écran derrière le dropdown)
    await page.mouse.click(200, 400);

    await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();
  });

  test('dropdown closes on menu item click', async ({ page }) => {
    await page.locator('img[alt="burger"]').click();
    await expect(page.locator('text=Renommer')).toBeVisible();

    await page.locator('text=Renommer').click();

    await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();
  });

  test('click outside dropdown does not create a stroke', async ({ page }) => {
    // Screenshot avant
    const canvasBefore = await page.locator('.konvajs-content canvas').screenshot();

    // Ouvrir et fermer le dropdown via click outside
    await page.locator('img[alt="burger"]').click();
    await expect(page.locator('text=Exporter en SVG')).toBeVisible();
    await page.mouse.click(200, 400);
    await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();

    await page.waitForTimeout(200);

    // Le canvas ne doit pas avoir changé
    const canvasAfter = await page.locator('.konvajs-content canvas').screenshot();
    expect(canvasBefore.equals(canvasAfter)).toBe(true);
  });
});
