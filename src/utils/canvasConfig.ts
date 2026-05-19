import { CanvasConfig, PX_PER_CM } from '../types';

/** Convertit des pixels en centimètres (1 décimale) */
export function pxToCm(px: number): number {
  return Math.round((px / PX_PER_CM) * 10) / 10;
}

/** Convertit des centimètres en pixels (arrondi entier) */
export function cmToPx(cm: number): number {
  return Math.round(cm * PX_PER_CM);
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Calcule les limites de la zone monde à partir de la config canevas.
 *  Le canevas est positionné à (0,0). La zone monde s'étend symétriquement autour. */
export function getWorldBounds(config: CanvasConfig): WorldBounds {
  const extra = (config.worldMultiplier - 1) / 2;
  return {
    minX: -config.canvasWidth * extra,
    maxX: config.canvasWidth * (1 + extra),
    minY: -config.canvasHeight * extra,
    maxY: config.canvasHeight * (1 + extra),
  };
}
