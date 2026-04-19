import { TextBox, TextLayer, Drawing, DrawLayer } from '../types';

// ─── Dimensions ────────────────────────────────────────────────────────────

/**
 * Mesure la largeur naturelle d'un texte via canvas 2D.
 * Fonction pure, pas de dépendances React.
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const weight = fontStyle.includes('bold') ? 'bold' : 'normal';
  const style  = fontStyle.includes('italic') ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
  const lines = text.split('\n');
  const maxLine = Math.max(...lines.map(l => ctx.measureText(l || ' ').width));
  return Math.max(maxLine + 16, 80); // +16 padding, min 80
}

/**
 * Découpe un texte en lignes visuelles selon une largeur max (word wrap).
 * Respecte les retours à la ligne explicites (\n) puis coupe les mots
 * qui dépassent la largeur disponible.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
  padding = 0,
): string[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const weight = fontStyle.includes('bold') ? 'bold' : 'normal';
  const style = fontStyle.includes('italic') ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;

  const availableWidth = maxWidth - padding * 2;
  const result: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (paragraph === '') { result.push(''); continue; }
    const words = paragraph.split(/(\s+)/); // garder les espaces
    let line = '';
    for (const word of words) {
      const test = line + word;
      if (ctx.measureText(test).width > availableWidth && line !== '') {
        result.push(line);
        line = word.trimStart(); // pas d'espace en début de nouvelle ligne
      } else {
        line = test;
      }
    }
    if (line) result.push(line);
  }

  return result.length > 0 ? result : [''];
}

/**
 * Calcule la hauteur estimée d'une textbox depuis son contenu.
 * Utilisé comme fallback quand le nœud Konva n'est pas encore monté.
 */
export function estimateTextHeight(tb: TextBox): number {
  const lineCount = tb.text.split('\n').length || 1;
  return Math.max(tb.fontSize * 1.4 * lineCount + tb.padding * 2, 20);
}

/**
 * Retourne la hauteur effective d'une textbox :
 * - konvaHeight si disponible (mesure réelle Konva)
 * - sinon estimation
 */
export function resolveTextBoxHeight(
  tb: TextBox,
  konvaHeight?: number,
): number {
  if (konvaHeight !== undefined) return Math.max(konvaHeight, 20);
  return estimateTextHeight(tb);
}

// ─── Hit testing ───────────────────────────────────────────────────────────

export interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Retourne le rectangle de hit d'une textbox (zone cliquable/draggable).
 * PAD ajoute une marge autour du contenu.
 */
export function getTextBoxHitRect(tb: TextBox, height: number, pad = 4): HitRect {
  return {
    x: tb.x - pad,
    y: tb.y - pad,
    w: tb.width + pad * 2,
    h: height + pad * 2,
  };
}

/**
 * Teste si un point (px, py) est dans le rectangle de hit d'une textbox.
 */
export function isPointInTextBox(
  px: number,
  py: number,
  tb: TextBox,
  height: number,
  pad = 4,
): boolean {
  const r = getTextBoxHitRect(tb, height, pad);
  // Si le TB est rotaté, dé-rotater le point dans le repère local du TB
  let lpx = px, lpy = py;
  const rotation = (tb as TextLayer).rotation ?? 0;
  if (rotation !== 0) {
    const cx = tb.x + tb.width / 2;
    const cy = tb.y + height / 2;
    const rad = (-rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    lpx = dx * cos - dy * sin + cx;
    lpy = dx * sin + dy * cos + cy;
  }
  return lpx >= r.x && lpx <= r.x + r.w && lpy >= r.y && lpy <= r.y + r.h;
}

/**
 * Parmi une liste de textboxes, retourne celle qui contient le point,
 * en priorité la dernière (z-index le plus élevé).
 * Retourne null si aucune.
 */
export function findTextBoxAtPoint(
  px: number,
  py: number,
  textBoxes: TextBox[],
  heights: Map<string, number>,
  pad = 4,
): TextBox | null {
  // Parcours en sens inverse pour respecter le z-index (dernier = au-dessus)
  for (let i = textBoxes.length - 1; i >= 0; i--) {
    const tb = textBoxes[i];
    const h = heights.get(tb.id) ?? estimateTextHeight(tb);
    if (isPointInTextBox(px, py, tb, h, pad)) return tb;
  }
  return null;
}

/**
 * Teste si deux rectangles ont une intersection non vide.
 */
export function isRectIntersecting(a: HitRect, b: HitRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x
      && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ─── Transitions d'état ────────────────────────────────────────────────────

export type TextBoxSelectionState =
  | { kind: 'idle' }
  | { kind: 'selected'; id: string }
  | { kind: 'editing'; id: string };

/**
 * Calcule le prochain état de sélection après un clic à (px, py).
 * Logique pure, sans effets de bord.
 */
export function nextSelectionState(
  current: TextBoxSelectionState,
  px: number,
  py: number,
  textBoxes: TextBox[],
  heights: Map<string, number>,
  pad = 4,
): TextBoxSelectionState {
  const hit = findTextBoxAtPoint(px, py, textBoxes, heights, pad);

  if (!hit) {
    // Clic dans le vide → idle (désélectionne)
    return { kind: 'idle' };
  }

  switch (current.kind) {
    case 'idle':
      // 1er tap sur une textbox → sélection seulement
      return { kind: 'selected', id: hit.id };

    case 'selected':
      if (current.id === hit.id) {
        // 2ème tap sur la même box → passer en édition
        return { kind: 'editing', id: hit.id };
      }
      // Tap sur une autre box → sélectionne la nouvelle (reset double-tap)
      return { kind: 'selected', id: hit.id };

    case 'editing':
      if (current.id === hit.id) {
        // Tap dans la box en cours d'édition → reste en édition
        return { kind: 'editing', id: hit.id };
      }
      // Tap sur une autre box → sélectionne la nouvelle (sort d'édition)
      return { kind: 'selected', id: hit.id };
  }
}

/**
 * Calcule le prochain état après Escape ou clic en dehors.
 */
export function exitState(
  current: TextBoxSelectionState,
): TextBoxSelectionState {
  if (current.kind === 'idle') return current;
  return { kind: 'idle' };
}

// ─── Scale ─────────────────────────────────────────────────────────────────

/**
 * Scale une textbox par `scaleFactor` autour d'un centre optionnel (cx, cy).
 * - fontSize scalé (min 8, max 200) — PAS arrondi ici (arrondi au relâchement)
 * - width scalé proportionnellement → conserve le lineCount naturellement
 * - position ajustée si centre de groupe fourni
 */
export function scaleTextBox(
  tb: TextLayer,
  scaleFactor: number,
  cx?: number,
  cy?: number,
): TextLayer {
  const newFontSize = Math.max(8, Math.min(200, tb.fontSize * scaleFactor));
  const newWidth = Math.max(50, tb.width * scaleFactor);

  let newX = tb.x;
  let newY = tb.y;
  if (cx !== undefined && cy !== undefined) {
    newX = (tb.x - cx) * scaleFactor + cx;
    newY = (tb.y - cy) * scaleFactor + cy;
  }

  return { ...tb, fontSize: newFontSize, width: newWidth, x: newX, y: newY };
}

/**
 * Arrondit le fontSize d'une TextLayer à l'entier le plus proche.
 * Appelé une seule fois au relâchement du handle scale.
 */
export function roundTextBoxFontSize(tb: TextLayer): TextLayer {
  return { ...tb, fontSize: Math.round(tb.fontSize) };
}

// ─── Factory & migration ────────────────────────────────────────────────────

export const makeTextLayer = (id: string, x: number, y: number): TextLayer => ({
  tool: 'text',
  id, x, y,
  width: 340,
  text: '', fontSize: 12, fontFamily: 'Arial', fontStyle: 'normal',
  textDecoration: '', align: 'left', verticalAlign: 'top',
  color: '#000000', background: '', opacity: 1, padding: 8,
});

export function migrateLayers(drawing: Drawing): DrawLayer[] {
  let layers: DrawLayer[] = drawing.layers ?? [
    ...(drawing.strokes ?? []),
    ...(drawing.airbrushStrokes ?? []),
  ];
  // Legacy textBoxes séparées (avant v1.3)
  if (drawing.textBoxes && drawing.textBoxes.length > 0) {
    const alreadyMigrated = layers.some(l => l.tool === 'text');
    if (!alreadyMigrated) {
      layers = [...layers, ...drawing.textBoxes.map(tb => ({ ...tb, tool: 'text' as const }))];
    }
  }
  return layers;
}
