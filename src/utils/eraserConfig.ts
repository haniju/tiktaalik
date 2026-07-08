// Configuration de la gomme — taille (rayon en px monde) partagée entre
// le hit-test d'effacement (eraseAt) et le feedback visuel (cercle curseur).
// Le rayon du cercle EST la taille de la gomme → le curseur reflète exactement
// la zone effacée.

export const ERASER_MIN_SIZE = 4;
export const ERASER_MAX_SIZE = 80;
export const ERASER_DEFAULT_SIZE = 20;
export const ERASER_SIZE_STEP = 2;

/** Borne la taille de la gomme dans [min, max] ; retourne le défaut si NaN. */
export function clampEraserSize(size: number): number {
  if (Number.isNaN(size)) return ERASER_DEFAULT_SIZE;
  return Math.max(ERASER_MIN_SIZE, Math.min(ERASER_MAX_SIZE, size));
}

/**
 * Props géométriques du cercle de feedback de la gomme.
 * Le rayon est exactement `eraserSize` : le curseur affiché correspond à la zone
 * réellement effacée par `eraseAt`. Le trait et les pointillés sont compensés par
 * le zoom (`stageScale`) pour garder une épaisseur constante à l'écran.
 */
export function eraserCursorProps(eraserSize: number, stageScale: number): {
  radius: number;
  strokeWidth: number;
  dash: number[];
} {
  return {
    radius: eraserSize,
    strokeWidth: 1.5 / stageScale,
    dash: [4 / stageScale, 3 / stageScale],
  };
}
