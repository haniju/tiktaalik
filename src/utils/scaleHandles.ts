import { Rect } from './bounds';

export interface Point { x: number; y: number }

/** En deçà de cette distance de référence, le ratio n'est pas calculable (division instable). */
export const MIN_REF_DIST = 1e-3;

/** Plancher du facteur d'échelle — évite qu'un objet s'effondre à zéro (irrécupérable). */
export const MIN_SCALE_FACTOR = 0.02;

/**
 * Les 4 coins de la bbox, dans l'ordre horaire depuis le top-left.
 * L'ordre importe : `oppositeCorner` s'appuie dessus.
 */
export function boundsCorners(bounds: Rect): [Point, Point, Point, Point] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

/** Coin diagonalement opposé à l'index `i` — le point fixe d'un scale par le côté. */
export function oppositeCorner(bounds: Rect, i: number): Point {
  return boundsCorners(bounds)[(i + 2) % 4];
}

export function boundsCenter(bounds: Rect): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/** Distance de référence du handle central : la demi-diagonale de la bbox. */
export function halfDiagonal(bounds: Rect): number {
  return Math.hypot(bounds.width, bounds.height) / 2;
}

/**
 * Facteur d'échelle d'un handle de coin : ratio des distances au coin opposé.
 *
 * `refDist` = dist(coin, origine) figée au dragStart — les bounds bougent pendant
 * le drag, la recalculer donnerait un ratio toujours égal à 1.
 */
export function cornerScaleFactor(pointer: Point, origin: Point, refDist: number): number {
  if (refDist <= MIN_REF_DIST) return 1;
  const dist = Math.hypot(pointer.x - origin.x, pointer.y - origin.y);
  return Math.max(MIN_SCALE_FACTOR, dist / refDist);
}

/**
 * Facteur d'échelle du handle central, piloté par le déplacement **vertical** seul :
 * vers le haut agrandit, vers le bas réduit.
 *
 * Pourquoi pas une distance radiale comme pour les coins : le pointeur démarre sur
 * l'origine, donc `dist` est toujours positive — on ne pourrait qu'agrandir. Lui
 * donner un signe (« au-dessus / en-dessous du centre ») introduirait une
 * discontinuité : un drag horizontal traversant `y = cy` sauterait de 1.5 à 0.5.
 */
export function centerScaleFactor(pointer: Point, origin: Point, refDist: number): number {
  if (refDist <= MIN_REF_DIST) return 1;
  return Math.max(MIN_SCALE_FACTOR, 1 + (origin.y - pointer.y) / refDist);
}
