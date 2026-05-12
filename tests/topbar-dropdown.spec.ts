import { test, expect, devices } from '@playwright/test';

test.describe('Topbar dropdown menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Créer un dessin pour accéder au SketchScreen
    await page.click('text=+ Nouveau');
    // Attendre que le canvas soit visible (SketchScreen chargé)
    await page.waitForSelector('.konvajs-content', { timeout: 5000 });
  });

  test('dropdown opens on burger click', async ({ page }) => {
    // Le dropdown ne doit pas être visible au départ
    await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();

    // Cliquer sur le burger (dernier bouton de la topbar avec l'icône burger)
    await page.locator('img[alt="burger"]').click();

    // Le dropdown doit être visible
    await expect(page.locator('text=Exporter en SVG')).toBeVisible();
  });

  test('dropdown closes on click outside', async ({ page }) => {
    // Ouvrir le dropdown
    await page.locator('img[alt="burger"]').click();
    await expect(page.locator('text=Exporter en SVG')).toBeVisible();

    // Cliquer en dehors du dropdown — sur le canvas
    const canvas = page.locator('.konvajs-content');
    await canvas.click({ position: { x: 200, y: 300 } });

    // Le dropdown doit se fermer
    await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();
  });

  test('dropdown closes on menu item click', async ({ page }) => {
    // Ouvrir le dropdown
    await page.locator('img[alt="burger"]').click();
    await expect(page.locator('text=Renommer')).toBeVisible();

    // Cliquer sur "Renommer" (ferme le menu et active l'édition inline)
    await page.locator('text=Renommer').click();

    // Le dropdown doit se fermer
    await expect(page.locator('text=Exporter en SVG')).not.toBeVisible();
  });
});

