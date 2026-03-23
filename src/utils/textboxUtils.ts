import { TextBox } from '../types';

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
 * Calcule la hauteur estimée d'une textbox depuis son contenu.
 * Utilisé comme fallback quand le nœud Konva n'est pas encore monté.
 */
export function estimateTextHeight(tb: TextBox): number {
  const lineCount = tb.text.split('\n').length || 1;
  return Math.max(tb.fontSize * 1.4 * lineCount + tb.padding * 2, 20);
}

/**
 * Retourne la hauteur effective d'une textbox :
 * - manualHeight si défini (resize manuel)
 * - konvaHeight si disponible (mesure réelle Konva)
 * - sinon estimation
 */
export function resolveTextBoxHeight(
  tb: TextBox,
  konvaHeight?: number,
): number {
  if (tb.manualHeight) return tb.manualHeight;
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
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
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
