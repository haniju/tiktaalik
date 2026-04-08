import { CanvasMode } from '../types';
import { Icon } from './Icon';

const MIN_ZOOM = 10;
const MAX_ZOOM = 400;

interface Props {
  canvasMode: CanvasMode;
  zoomPct: number;
  onSetMode: (mode: CanvasMode) => void;
  onZoomChange: (pct: number) => void;
}

export function ActionFABs({ canvasMode, zoomPct, onSetMode, onZoomChange }: Props) {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomPct));

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

      {/* Zoom slider */}
      <div style={styles.zoomContainer}>
        <span style={styles.zoomLabel}>{clamped}%</span>
        <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={5}
          value={clamped}
          onChange={e => onZoomChange(Number(e.target.value))}
          style={styles.zoomSlider} />
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
    background: '#333',
  },
  zoomContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    padding: '6px 12px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.13)',
  },
  zoomLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#444',
    minWidth: 34,
    textAlign: 'right' as const,
  },
  zoomSlider: {
    width: 120,
    cursor: 'pointer',
    accentColor: '#118ab2',
  },
};
