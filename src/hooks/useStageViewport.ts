import { useRef, useState, useCallback, useEffect } from 'react';
import Konva from 'konva';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// Zone monde = 3×3 A4 centrée sur la page de dessin
const WORLD_MIN_X = -A4_WIDTH;
const WORLD_MAX_X = 2 * A4_WIDTH;
const WORLD_MIN_Y = -A4_HEIGHT;
const WORLD_MAX_Y = 2 * A4_HEIGHT;

/** Clamp la position du stage pour que le centre du viewport reste dans la zone 3×3 A4 */
export function clampStagePos(
  pos: { x: number; y: number },
  scale: number,
  viewportW: number,
  viewportH: number,
): { x: number; y: number } {
  return {
    x: Math.max(viewportW / 2 - WORLD_MAX_X * scale, Math.min(viewportW / 2 - WORLD_MIN_X * scale, pos.x)),
    y: Math.max(viewportH / 2 - WORLD_MAX_Y * scale, Math.min(viewportH / 2 - WORLD_MIN_Y * scale, pos.y)),
  };
}

export const TOPBAR_H = 48;
export const DRAWINGBAR_H = 48;

interface UseStageViewportReturn {
  stageRef: React.RefObject<Konva.Stage>;
  stageSize: { width: number; height: number };
  zoomPct: number;
  setZoomPct: React.Dispatch<React.SetStateAction<number>>;
  canvasH: number;
  TOPBAR_H: number;
  DRAWINGBAR_H: number;
  centerViewOn: (cx: number, cy: number, immediate?: boolean, topOffsetPx?: number) => void;
  zoomTo: (pct: number) => void;
}

export function useStageViewport(): UseStageViewportReturn {
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [zoomPct, setZoomPct] = useState(100);

  // canvasH = hauteur totale moins les deux barres fixes (ContextToolbar et SelectionPanel flottent par-dessus)
  const canvasH = stageSize.height - TOPBAR_H - DRAWINGBAR_H;

  useEffect(() => {
    const fn = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sc = 1.0; // 100% par défaut
    stage.scale({ x: sc, y: sc });
    stage.position(clampStagePos(
      { x: (stageSize.width - A4_WIDTH * sc) / 2, y: (canvasH - A4_HEIGHT * sc) / 2 },
      sc, stageSize.width, canvasH,
    ));
    stage.batchDraw();
    setZoomPct(100);
  }, []); // stageRef/setZoomPct sont stables, le tableau vide est intentionnel

  // Translate le Stage pour centrer (cx, cy) dans la zone visible — zoom inchangé
  // topOffsetPx : pixels supplémentaires occupés en haut (ex. text toolbar) à exclure du centre visible
  const centerViewOn = useCallback((cx: number, cy: number, immediate = false, topOffsetPx = 0) => {
    const stage = stageRef.current;
    if (!stage) return;
    const sc = stage.scaleX();
    const effectiveH = canvasH - topOffsetPx;
    const centerY = topOffsetPx + effectiveH / 2;
    const visibleCx = (stageSize.width / 2 - stage.x()) / sc;
    const visibleCy = (centerY - stage.y()) / sc;
    const threshold = Math.min(stageSize.width, effectiveH) * 0.2 / sc;
    if (Math.hypot(cx - visibleCx, cy - visibleCy) < threshold) return;
    const clamped = clampStagePos(
      { x: stageSize.width / 2 - cx * sc, y: centerY - cy * sc },
      sc, stageSize.width, canvasH,
    );
    if (immediate) {
      stage.position(clamped);
      stage.batchDraw();
    } else {
      stage.to({ x: clamped.x, y: clamped.y, duration: 0.15, easing: Konva.Easings.EaseOut });
    }
  }, [stageSize.width, canvasH]);

  // Zoom centré sur le milieu de la zone canvas visible
  const zoomTo = useCallback((pct: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const ns = pct / 100;
    const sc = stage.scaleX();
    const cx = (stageSize.width / 2 - stage.x()) / sc;
    const cy = (canvasH / 2 - stage.y()) / sc;
    stage.scale({ x: ns, y: ns });
    stage.position(clampStagePos(
      { x: stageSize.width / 2 - cx * ns, y: canvasH / 2 - cy * ns },
      ns, stageSize.width, canvasH,
    ));
    stage.batchDraw();
    setZoomPct(Math.round(ns * 100));
  }, [stageSize.width, canvasH]);

  return { stageRef, stageSize, zoomPct, setZoomPct, canvasH, TOPBAR_H, DRAWINGBAR_H, centerViewOn, zoomTo };
}
