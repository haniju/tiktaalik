import { test, expect, Page } from '@playwright/test';

const zoomSlider = (page: Page) => page.locator('[data-fabs] input[type=range]');

/** Session stockée dans IndexedDB pour le premier (unique) dessin */
function readSession(page: Page) {
  return page.evaluate(() => new Promise<Record<string, unknown> | null>((resolve, reject) => {
    const req = indexedDB.open('tiktaalik_db');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const all = req.result.transaction('drawings', 'readonly').objectStore('drawings').getAll();
      all.onsuccess = () => resolve(all.result[0]?.session ?? null);
      all.onerror = () => reject(all.error);
    };
  }));
}

test.describe('Restauration de la session du dessin', () => {
  test('zoom et position du viewport survivent à un aller-retour', async ({ page }) => {
    await page.goto('/');
    await page.click('text=+ Nouveau');
    await page.waitForSelector('.konvajs-content', { timeout: 5000 });

    const name = await page.locator('[data-bars] span, [data-bars] h1').first().textContent();
    await expect(zoomSlider(page)).toHaveValue('100');

    // Zoom molette sur le canvas → change scale ET position du stage
    const canvas = page.locator('.konvajs-content');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -120);

    const zoomed = await zoomSlider(page).inputValue();
    expect(Number(zoomed)).toBeGreaterThan(100);

    // Retour à la galerie → flush de la session
    await page.locator('[data-bars] button').first().click();
    await page.waitForSelector('text=+ Nouveau');

    const session = await readSession(page);
    expect(session).toBeTruthy();
    expect(session!.view).toBeTruthy();
    expect(session!.activeTool).toBe('pen');

    // Réouverture → zoom restauré
    await page.click(`text=${name}`);
    await page.waitForSelector('.konvajs-content', { timeout: 5000 });
    await expect(zoomSlider(page)).toHaveValue(zoomed);
  });

  test('un rechargement complet de la page restaure aussi le zoom', async ({ page }) => {
    await page.goto('/');
    await page.click('text=+ Nouveau');
    await page.waitForSelector('.konvajs-content', { timeout: 5000 });

    const canvas = page.locator('.konvajs-content');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -120);
    const zoomed = await zoomSlider(page).inputValue();

    const name = await page.locator('[data-bars] span, [data-bars] h1').first().textContent();
    await page.locator('[data-bars] button').first().click();
    await page.waitForSelector('text=+ Nouveau');

    await page.reload();
    await page.click(`text=${name}`);
    await page.waitForSelector('.konvajs-content', { timeout: 5000 });
    await expect(zoomSlider(page)).toHaveValue(zoomed);
  });
});
