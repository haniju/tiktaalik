import { test, expect, Page } from '@playwright/test';

/**
 * Scale par les poignées de la bounding box.
 *
 * Ce que ce spec couvre et que les tests unitaires (`src/utils/scaleHandles.test.ts`)
 * ne peuvent pas voir : le câblage réel des events de drag Konva jusqu'à la
 * géométrie persistée — la bonne poignée est-elle sous le pointeur, le drag
 * déclenche-t-il bien la chaîne onScaleStart/Move/End, l'origine transmise
 * est-elle la bonne.
 *
 * On ne devine PAS la position écran des poignées (la vue se recentre au focus) :
 * on lit le rectangle orange de la bounding box directement dans le stage Konva,
 * en coords absolues (post-transform) — c'est exactement là que sont les poignées.
 * Chaque test travaille sur un unique dessin : `readLayers` lit `result[0]`.
 */

interface Stroke { tool: string; points: number[] }

function readLayers(page: Page) {
  return page.evaluate(() => new Promise<Stroke[]>((resolve, reject) => {
    const req = indexedDB.open('tiktaalik_db');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const all = req.result.transaction('drawings', 'readonly').objectStore('drawings').getAll();
      all.onsuccess = () => resolve(all.result[0]?.layers ?? []);
      all.onerror = () => reject(all.error);
    };
  }));
}

/** Force le flush de l'autosave sans quitter le dessin (voir useAutosave: visibilitychange). */
async function flush(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/**
 * Bbox écran des poignées = rectangle orange (#f4a261) de la bounding box, lu
 * en coords absolues dans le stage Konva puis décalé de l'offset du container.
 */
async function handleBox(page: Page) {
  const b = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).Konva.stages[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rect = s.find('Rect').find((r: any) => r.stroke() === '#f4a261');
    if (!rect) return null;
    const r = rect.getClientRect(); // absolu (post-transform), relatif au container
    const cont = s.container().getBoundingClientRect();
    return { x: cont.left + r.x, y: cont.top + r.y, w: r.width, h: r.height };
  });
  if (!b) throw new Error('bounding box de scale introuvable dans le stage');
  return {
    ...b,
    tl: { x: b.x, y: b.y },
    br: { x: b.x + b.w, y: b.y + b.h },
    center: { x: b.x + b.w / 2, y: b.y + b.h / 2 },
  };
}

function strokeBounds(layers: Stroke[]) {
  const s = layers.find(l => l.tool === 'pen');
  if (!s) throw new Error('aucun trait dans les layers persistés');
  const xs = s.points.filter((_, i) => i % 2 === 0);
  const ys = s.points.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    minX, minY, maxX, maxY,
    width: maxX - minX, height: maxY - minY,
    cx: (minX + maxX) / 2, cy: (minY + maxY) / 2,
  };
}

/** Drag lent — Konva a besoin de plusieurs dragmove pour émettre le scale. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(60);
}

/**
 * Nouveau dessin + trait diagonal centré, sélectionné, focalisé, sous-mode scale.
 * Retourne la bbox écran des poignées (via Konva) et la bbox monde persistée.
 */
async function setup(page: Page) {
  await page.goto('/');
  await page.click('text=+ Nouveau');
  await page.waitForSelector('.konvajs-content', { timeout: 5000 });
  await page.waitForTimeout(400); // guard anti-fantôme (300 ms après mount)

  const box = (await page.locator('.konvajs-content').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const tl = { x: cx - 60, y: cy - 60 }, br = { x: cx + 60, y: cy + 60 };

  await drag(page, tl, br); // trait diagonal

  await page.click('[data-fabs] button[title="Sélectionner"]');
  await page.waitForTimeout(80);
  await drag(page, { x: tl.x - 40, y: tl.y - 40 }, { x: br.x + 40, y: br.y + 40 }); // lasso
  await page.click('button[title="Tout focaliser"]');
  await page.waitForTimeout(80);
  await page.click('button[title="Redimensionner"]');
  await page.waitForTimeout(200);

  await flush(page);
  return { hb: await handleBox(page), before: strokeBounds(await readLayers(page)) };
}

test.describe('Poignées de scale', () => {
  test('coin : le coin opposé reste fixe, la forme grandit proportionnellement', async ({ page }) => {
    const { hb, before } = await setup(page);
    // Drag du coin top-left vers l'extérieur (s'éloigne du coin opposé)
    await drag(page, hb.tl, { x: hb.tl.x - 100, y: hb.tl.y - 100 });
    await flush(page);
    const after = strokeBounds(await readLayers(page));

    // Coin opposé = point fixe. Tolérance ~5 px : l'origine réelle est le coin de
    // la bbox (points ± width/2), donc le point extrême du trait se décale un peu
    // du padding scalé — comportement attendu, pas une dérive.
    expect(Math.abs(after.maxX - before.maxX)).toBeLessThan(5);
    expect(Math.abs(after.maxY - before.maxY)).toBeLessThan(5);
    // Grandi, ratio w/h conservé
    expect(after.width).toBeGreaterThan(before.width * 1.4);
    expect(after.width / after.height).toBeCloseTo(before.width / before.height, 1);
  });

  test('coin : drag vers le coin opposé rétrécit la forme', async ({ page }) => {
    const { hb, before } = await setup(page);
    await drag(page, hb.tl, hb.center); // mi-chemin vers le coin opposé
    await flush(page);
    const after = strokeBounds(await readLayers(page));

    expect(Math.abs(after.maxX - before.maxX)).toBeLessThan(5);
    expect(Math.abs(after.maxY - before.maxY)).toBeLessThan(5);
    expect(after.width).toBeLessThan(before.width * 0.75);
  });

  test('centre : le centre reste fixe, drag vertical agrandit symétriquement', async ({ page }) => {
    const { hb, before } = await setup(page);
    await drag(page, hb.center, { x: hb.center.x, y: hb.center.y - 80 }); // vers le haut
    await flush(page);
    const after = strokeBounds(await readLayers(page));

    expect(Math.abs(after.cx - before.cx)).toBeLessThan(5);
    expect(Math.abs(after.cy - before.cy)).toBeLessThan(5);
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.width / after.height).toBeCloseTo(before.width / before.height, 1);
  });

  test('centre : drag vertical vers le bas rétrécit', async ({ page }) => {
    const { hb, before } = await setup(page);
    await drag(page, hb.center, { x: hb.center.x, y: hb.center.y + 40 });
    await flush(page);
    const after = strokeBounds(await readLayers(page));
    expect(after.width).toBeLessThan(before.width);
  });

  test('centre : un drag horizontal traversant le centre ne change (presque) rien', async ({ page }) => {
    // Régression : une distance radiale signée sauterait de ~1.5 à ~0.5 ici
    const { hb, before } = await setup(page);
    await drag(page, hb.center, { x: hb.center.x + 100, y: hb.center.y });
    await flush(page);
    const after = strokeBounds(await readLayers(page));
    expect(Math.abs(after.width - before.width)).toBeLessThan(5);
  });
});
