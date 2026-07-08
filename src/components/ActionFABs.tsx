import { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasMode } from '../types';
import { Icon } from './Icon';
import { FabKey, FabPosition } from '../hooks/useFabPositions';

const MIN_ZOOM = 20;
const MAX_ZOOM = 400;
const ZOOM_STEP = 10;
const LABEL_TIMEOUT = 5000;
const HOLD_THRESHOLD = 250;

interface Props {
  canvasMode: CanvasMode;
  zoomPct: number;
  isDirty: boolean;
  saveError: boolean;
  onToggleSelect: () => void;
  onTogglePan: () => void;
  onEnterPan: () => void;
  onExitPan: () => void;
  onZoomChange: (pct: number) => void;
  fabPositions: Partial<Record<FabKey, FabPosition>>;
  repositioning: boolean;
  onDragFab: (key: FabKey, pos: FabPosition) => void;
}

export function ActionFABs({ canvasMode, zoomPct, isDirty, saveError, onToggleSelect, onTogglePan, onEnterPan, onExitPan, onZoomChange, fabPositions, repositioning, onDragFab }: Props) {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomPct));
  const [showLabel, setShowLabel] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevZoomRef = useRef(clamped);

  // Hold-to-pan sur le FAB
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);

  const handlePanPointerDown = useCallback(() => {
    isHoldingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      onEnterPan();
    }, HOLD_THRESHOLD);
  }, [onEnterPan]);

  const handlePanPointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      onExitPan();
    } else {
      onTogglePan();
    }
  }, [onTogglePan, onExitPan]);

  // ─── Repositionnement libre des boutons pan/select ─────────────────────────
  const [dragKey, setDragKey] = useState<FabKey | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const startDrag = useCallback((key: FabKey) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!repositioning) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setDragKey(key);
    setDragOffset({ x: 0, y: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [repositioning]);

  const moveDrag = useCallback((key: FabKey) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!repositioning || dragKey !== key) return;
    setDragOffset({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
  }, [repositioning, dragKey]);

  const endDrag = useCallback((key: FabKey) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!repositioning || dragKey !== key) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onDragFab(key, {
      x: Math.min(1, Math.max(0, (rect.left + rect.width / 2) / window.innerWidth)),
      y: Math.min(1, Math.max(0, (rect.top + rect.height / 2) / window.innerHeight)),
    });
    setDragKey(null);
    setDragOffset({ x: 0, y: 0 });
  }, [repositioning, dragKey, onDragFab]);

  function fabPositionStyle(key: FabKey): React.CSSProperties {
    const custom = fabPositions[key];
    const dragging = dragKey === key;
    const transform = dragging ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined;
    if (custom) {
      return {
        position: 'fixed',
        left: `${custom.x * 100}%`,
        top: `${custom.y * 100}%`,
        transform: transform ? `translate(-50%, -50%) ${transform}` : 'translate(-50%, -50%)',
        zIndex: dragging ? 150 : 100,
      };
    }
    return transform ? { position: 'relative', transform, zIndex: 150 } : {};
  }

  useEffect(() => {
    if (clamped !== prevZoomRef.current) {
      prevZoomRef.current = clamped;
      setShowLabel(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowLabel(false), LABEL_TIMEOUT);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [clamped]);

  const zoomBy = (delta: number) => {
    onZoomChange(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, clamped + delta)));
  };

  return (
    <div data-fabs style={styles.root}>
      {/* Mode move — tap: toggle, hold: pan momentané */}
      <button
        style={{
          ...styles.fab,
          ...(canvasMode === 'move' ? styles.fabActive : {}),
          ...(repositioning ? styles.fabRepositioning : {}),
          touchAction: 'none',
          ...fabPositionStyle('pan'),
        }}
        onPointerDown={repositioning ? startDrag('pan') : handlePanPointerDown}
        onPointerMove={repositioning ? moveDrag('pan') : undefined}
        onPointerUp={repositioning ? endDrag('pan') : handlePanPointerUp}
        onPointerCancel={repositioning ? endDrag('pan') : handlePanPointerUp}
        onContextMenu={e => e.preventDefault()}
        title="Déplacer"
      >
        <Icon name="drag" size={20} style={{ opacity: canvasMode === 'move' ? 0.9 : 0.6 }} />
      </button>

      {/* Mode select */}
      <button
        style={{
          ...styles.fab,
          ...(canvasMode === 'select' ? styles.fabActive : {}),
          ...(repositioning ? styles.fabRepositioning : {}),
          touchAction: 'none',
          ...fabPositionStyle('select'),
        }}
        onClick={repositioning ? undefined : onToggleSelect}
        onPointerDown={repositioning ? startDrag('select') : undefined}
        onPointerMove={repositioning ? moveDrag('select') : undefined}
        onPointerUp={repositioning ? endDrag('select') : undefined}
        onPointerCancel={repositioning ? endDrag('select') : undefined}
        title="Sélectionner"
      >
        <Icon name="select" size={20} style={{ opacity: canvasMode === 'select' ? 0.9 : 0.6 }} />
      </button>

      {/* Zoom controls */}
      <div style={styles.zoomWrapper}>
        {/* Label flottant au-dessus */}
        <span style={{
          ...styles.zoomLabel,
          opacity: showLabel ? 1 : 0,
          transform: showLabel ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(4px)',
        }}>{clamped}%</span>

        <div style={styles.zoomContainer}>
          <button style={styles.zoomBtn} onClick={() => zoomBy(-ZOOM_STEP)}>−</button>
          <input type="range" className="app-slider" min={MIN_ZOOM} max={MAX_ZOOM} step={5}
            value={clamped}
            onChange={e => onZoomChange(Number(e.target.value))}
            style={styles.zoomSlider} />
          <button style={styles.zoomBtn} onClick={() => zoomBy(ZOOM_STEP)}>+</button>
        </div>

        {/* Pastille état de sauvegarde */}
        <div style={{
          position: 'absolute',
          bottom: -4,
          right: -4,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: saveError ? '#ef4444' : isDirty ? '#f59e0b' : '#22c55e',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          transition: 'background 0.3s ease',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 16,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  fab: {
    width: 44, height: 44,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#fff',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    transition: 'background 0.15s',
    flexShrink: 0,
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
  },
  fabActive: {
    background: 'linear-gradient(135deg, #118ab2, #06d6a0)',
  },
  fabRepositioning: {
    boxShadow: '0 0 0 2px #f59e0b, 0 2px 10px rgba(0,0,0,0.15)',
    cursor: 'grab',
  },
  zoomWrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  zoomLabel: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 700,
    color: '#444',
    background: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: '3px 8px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
  },
  zoomContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: '4px 6px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.13)',
  },
  zoomBtn: {
    width: 28, height: 28,
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 18,
    fontWeight: 700,
    color: '#555',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
  },
  zoomSlider: {
    width: 100,
    height: 32,
  },
};
