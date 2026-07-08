import { Icon } from './Icon';
import { ERASER_MIN_SIZE, ERASER_MAX_SIZE, ERASER_SIZE_STEP } from '../utils/eraserConfig';

interface Props {
  size: number;
  onSizeChange: (size: number) => void;
}

/**
 * Panneau de réglage de la gomme — calqué sur le slider de lissage du DrawingPanel.
 * Un unique slider pilote la taille (rayon) de la gomme ; le cercle de feedback
 * autour du curseur en reflète directement la valeur.
 */
export function EraserPanel({ size, onSizeChange }: Props) {
  return (
    <div style={styles.root}>
      <div style={styles.row}>
        <Icon name="eraser" size={16} />
        <input
          type="range"
          className="app-slider"
          min={ERASER_MIN_SIZE}
          max={ERASER_MAX_SIZE}
          step={ERASER_SIZE_STEP}
          value={size}
          aria-label="Taille de la gomme"
          onChange={e => onSizeChange(+e.target.value)}
        />
        <span style={styles.value}>{size}px</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: '#fff', borderBottom: '1px solid #e8e8e8', flexShrink: 0 },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 44 },
  value: { fontSize: 11, color: '#888', width: 40, textAlign: 'right' as const, flexShrink: 0 },
};
