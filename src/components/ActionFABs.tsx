import { useState, useEffect, useRef } from 'react';
import { CanvasMode } from '../types';
import { Icon } from './Icon';

const MIN_ZOOM = 10;
const MAX_ZOOM = 400;
const ZOOM_STEP = 10;
const LABEL_TIMEOUT = 5000;

interface Props {
  canvasMode: CanvasMode;
  zoomPct: number;
  onSetMode: (mode: CanvasMode) => void;
  onZoomChange: (pct: number) => void;
}

export function ActionFABs({ canvasMode, zoomPct, onSetMode, onZoomChange }: Props) {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomPct));
  const [showLabel, setShowLabel] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevZoomRef = useRef(clamped);

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
      {/* Mode select */}
      <button
        style={{ ...styles.fab, ...(canvasMode === 'select' ? styles.fabActive : {}) }}
        onClick={() => onSetMode(canvasMode === 'select' ? 'draw' : 'select')}
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
      </div>

      {/* Mode move */}
      <button
        style={{ ...styles.fab, ...(canvasMode === 'move' ? styles.fabActive : {}) }}
        onClick={() => onSetMode(canvasMode === 'move' ? 'draw' : 'move')}
        title="Déplacer"
      >
        <Icon name="drag" size={20} style={{ opacity: canvasMode === 'move' ? 0.9 : 0.6 }} />
      </button>
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
  },
  fabActive: {
    background: 'linear-gradient(135deg, #118ab2, #06d6a0)',
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
  },
  zoomSlider: {
    width: 100,
    height: 32,
  },
};
