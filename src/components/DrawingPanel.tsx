import { DrawingTool } from '../types';
import { UnifiedColorPicker } from './UnifiedColorPicker';
import { Icon } from './Icon';

interface Props {
  tool: DrawingTool;
  color: string;
  width: number;
  opacity: number;
  airbrushEdgeOpacity: number;
  smoothing: number;
  bezierSmoothing: boolean;
  movingAverageSmoothing: boolean;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
  onAirbrushEdgeOpacityChange: (opacity: number) => void;
  onSmoothingChange: (smoothing: number) => void;
  onSelectClassicSmoothing: () => void;
  onToggleBezier: () => void;
  onToggleMovingAverage: () => void;
}

const SIZES = [1, 2, 4, 7, 11, 18, 28];

export function DrawingPanel({ tool, color, width, opacity, airbrushEdgeOpacity, smoothing, bezierSmoothing, movingAverageSmoothing, onColorChange, onWidthChange, onOpacityChange, onAirbrushEdgeOpacityChange, onSmoothingChange, onSelectClassicSmoothing, onToggleBezier, onToggleMovingAverage }: Props) {

  return (
    <div style={styles.root}>
      {/* Tailles */}
      <div style={styles.row}>
        {SIZES.map(s => (
          <button key={s} style={styles.sizeBtn} onClick={() => onWidthChange(s)}>
            <div style={{
              width: 6 + Math.sqrt((s - 1) / 27) * 32, height: 6 + Math.sqrt((s - 1) / 27) * 32,
              borderRadius: '50%', background: color,
              border: width === s ? '2.5px solid #222' : '2px solid transparent',
              boxSizing: 'border-box',
            }} />
          </button>
        ))}
      </div>

      {/* Couleurs */}
      <UnifiedColorPicker color={color} onChange={onColorChange} mode="drawing" />

      {/* Opacité — marker : 1 slider, airbrush : 2 sliders (centre + bord) */}
      {tool === 'marker' && (
        <div style={styles.opacityRow}>
          <Icon name="opacity" size={16} />
          <input type="range" className="app-slider" min={10} max={100} step={5}
            value={Math.round(opacity * 100)}
            onChange={e => onOpacityChange(+e.target.value / 100)} />
          <span style={styles.opacityValue}>{Math.round(opacity * 100)}%</span>
        </div>
      )}
      {tool === 'airbrush' && (<>
        <div style={styles.opacityRow}>
          <span style={styles.opacityLabel}>Centre</span>
          <input type="range" className="app-slider" min={5} max={100} step={5}
            value={Math.round(opacity * 100)}
            onChange={e => onOpacityChange(+e.target.value / 100)} />
          <span style={styles.opacityValue}>{Math.round(opacity * 100)}%</span>
        </div>
        <div style={styles.opacityRow}>
          <span style={styles.opacityLabel}>Bord</span>
          <input type="range" className="app-slider" min={0} max={100} step={5}
            value={Math.round(airbrushEdgeOpacity * 100)}
            onChange={e => onAirbrushEdgeOpacityChange(+e.target.value / 100)} />
          <span style={styles.opacityValue}>{Math.round(airbrushEdgeOpacity * 100)}%</span>
        </div>
      </>)}

      {/* Lissage — tous les outils */}
      <div style={styles.opacityRow}>
        <Icon name="lissage" size={16} />
        <input type="range" className="app-slider" min={0} max={100} step={5}
          value={Math.round(smoothing * 100)}
          onChange={e => onSmoothingChange(+e.target.value / 100)} />
        <span style={styles.opacityValue}>{Math.round(smoothing * 100)}%</span>
      </div>

      {/* Mode de lissage — pen/marker uniquement */}
      {(tool === 'pen' || tool === 'marker') && (
        <div style={styles.toggleRow}>
          <button
            style={{ ...styles.toggleBtn, ...(!bezierSmoothing && !movingAverageSmoothing ? styles.toggleBtnActive : {}) }}
            onClick={onSelectClassicSmoothing}
          >
            Classique
          </button>
          <button
            style={{ ...styles.toggleBtn, ...(bezierSmoothing ? styles.toggleBtnActive : {}) }}
            onClick={onToggleBezier}
          >
            Bézier
          </button>
          <button
            style={{ ...styles.toggleBtn, ...(movingAverageSmoothing ? styles.toggleBtnActive : {}) }}
            onClick={onToggleMovingAverage}
          >
            Moy. glissante
          </button>
        </div>
      )}

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: '#fff', borderBottom: '1px solid #e8e8e8', flexShrink: 0 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px' },
  sizeBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 2px', flex: 1, height: 44 },
  opacityRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 44, borderTop: '1px solid #f0f0f0' },
  opacityLabel: { fontSize: 12, color: '#666', flexShrink: 0 },
  opacityValue: { fontSize: 11, color: '#888', width: 34, textAlign: 'right' as const, flexShrink: 0 },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderTop: '1px solid #f0f0f0' },
  toggleBtn: { flex: 1, padding: '6px 0', fontSize: 12, border: '1.5px solid #ccc', borderRadius: 6, background: '#fff', color: '#666', cursor: 'pointer', fontWeight: 500 },
  toggleBtnActive: { background: '#222', color: '#fff', borderColor: '#222' },
};
