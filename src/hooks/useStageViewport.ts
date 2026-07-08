import { useRef, useState, useCallback, useEffect } from 'react';
import Konva from 'konva';
import { CanvasConfig, DEFAULT_CANVAS_CONFIG, DrawingView } from '../types';
import { getWorldBounds, WorldBounds } from '../utils/canvasConfig';

/** Clamp la position du stage pour que le centre du viewport reste dans la zone monde */
export function clampStagePos(
  pos: { x: number; y: number },
  scale: number,
  viewportW: number,
  viewportH: number,
  wb: WorldBounds,
): { x: number; y: number } {
  return {
    x: Math.max(viewportW / 2 - wb.maxX * scale, Math.min(viewportW / 2 - wb.minX * scale, pos.x)),
    y: Math.max(viewportH / 2 - wb.maxY * scale, Math.min(viewportH / 2 - wb.minY * scale, pos.y)),
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
  worldBounds: WorldBounds;
}

// Mêmes bornes que le pinch/wheel de useCanvasGestures (scale 0.2 → 40)
const MIN_ZOOM_PCT = 20;
const MAX_ZOOM_PCT = 4000;

function clampZoomPct(pct: number): number {
  if (!Number.isFinite(pct)) return 100;
  return Math.max(MIN_ZOOM_PCT, Math.min(MAX_ZOOM_PCT, pct));
}

/**
 * @param initialView Vue restaurée depuis `Drawing.session.view`. Absente → cadrage centré à 100 %.
 */
export function useStageViewport(
  canvasConfig: CanvasConfig = DEFAULT_CANVAS_CONFIG,
  initialView?: DrawingView,
): UseStageViewportReturn {
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  // Capturé une seule fois : la restauration ne doit pas se rejouer si le dessin est re-sauvegardé
  const initialViewRef = useRef(
    initialView && Number.isFinite(initialView.stageX) && Number.isFinite(initialView.stageY)
      ? initialView
      : undefined,
  );
  const [zoomPct, setZoomPct] = useState(() =>
    initialViewRef.current ? clampZoomPct(initialViewRef.current.zoomPct) : 100,
  );

  const canvasH = stageSize.height - TOPBAR_H - DRAWINGBAR_H;
  const wb = getWorldBounds(canvasConfig);
  const { canvasWidth, canvasHeight } = canvasConfig;

  useEffect(() => {
    const fn = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const saved = initialViewRef.current;
    // Vue restaurée, sinon canevas centré à 100 %
    const pct = saved ? clampZoomPct(saved.zoomPct) : 100;
    const sc = pct / 100;
    const raw = saved
      ? { x: saved.stageX, y: saved.stageY }
      : { x: (stageSize.width - canvasWidth * sc) / 2, y: (canvasH - canvasHeight * sc) / 2 };
    stage.scale({ x: sc, y: sc });
    // Le clamp rattrape un viewport de taille différente (rotation, autre appareil)
    stage.position(clampStagePos(raw, sc, stageSize.width, canvasH, wb));
    stage.batchDraw();
    setZoomPct(pct);
  }, []); // stageRef/setZoomPct sont stables, le tableau vide est intentionnel

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
      sc, stageSize.width, canvasH, wb,
    );
    if (immediate) {
      stage.position(clamped);
      stage.batchDraw();
    } else {
      stage.to({ x: clamped.x, y: clamped.y, duration: 0.15, easing: Konva.Easings.EaseOut });
    }
  }, [stageSize.width, canvasH, wb]);

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
      ns, stageSize.width, canvasH, wb,
    ));
    stage.batchDraw();
    setZoomPct(Math.round(ns * 100));
  }, [stageSize.width, canvasH, wb]);

  return { stageRef, stageSize, zoomPct, setZoomPct, canvasH, TOPBAR_H, DRAWINGBAR_H, centerViewOn, zoomTo, worldBounds: wb };
}
