import { useRef, useState, useCallback, useEffect } from 'react';
import Konva from 'konva';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

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
  centerViewOn: (cx: number, cy: number) => void;
}

export function useStageViewport(): UseStageViewportReturn {
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [zoomPct, setZoomPct] = useState(200);

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
    const sc = 2.0; // 200% par défaut
    stage.scale({ x: sc, y: sc });
    stage.position({
      x: (stageSize.width - A4_WIDTH * sc) / 2,
      y: (canvasH - A4_HEIGHT * sc) / 2,
    });
    stage.batchDraw();
    setZoomPct(200);
  }, []); // stageRef/setZoomPct sont stables, le tableau vide est intentionnel

  // Translate le Stage pour centrer (cx, cy) dans la zone visible — zoom inchangé
  const centerViewOn = useCallback((cx: number, cy: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const sc = stage.scaleX();
    const visibleCx = (stageSize.width / 2 - stage.x()) / sc;
    const visibleCy = (canvasH / 2 - stage.y()) / sc;
    const threshold = Math.min(stageSize.width, canvasH) * 0.2 / sc;
    if (Math.hypot(cx - visibleCx, cy - visibleCy) < threshold) return;
    const newX = stageSize.width / 2 - cx * sc;
    const newY = canvasH / 2 - cy * sc;
    stage.to({ x: newX, y: newY, duration: 0.15, easing: Konva.Easings.EaseOut });
  }, [stageSize.width, canvasH]);

  return { stageRef, stageSize, zoomPct, setZoomPct, canvasH, TOPBAR_H, DRAWINGBAR_H, centerViewOn };
}
