import { useState } from 'react';
import { DrawingTool } from '../types';
import { HslColorPicker } from './HslColorPicker';

interface Props {
  tool: DrawingTool;
  color: string;
  width: number;
  opacity: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
}

const SIZES = [1, 2, 4, 7, 11, 18, 28];
const PRESET_COLORS = ['#e63946', '#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5'];

export function DrawingPanel({ tool, color, width, opacity, onColorChange, onWidthChange, onOpacityChange }: Props) {
  const [expanded, setExpanded] = useState(false);

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
      <div style={styles.row}>
        {PRESET_COLORS.map(c => (
          <button key={c} style={styles.colorBtn} onClick={() => onColorChange(c)}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: c,
              border: color === c ? '2.5px solid #222' : '2px solid transparent',
              boxSizing: 'border-box',
            }} />
          </button>
        ))}
        <button style={styles.chevronBtn} onClick={() => setExpanded(p => !p)}>
          <img src={expanded ? '/icons/more.svg' : '/icons/less.svg'} width={20} height={20} alt="" />
        </button>
      </div>

      {/* Opacité — affiché pour le marker */}
      {tool === 'marker' && (
        <div style={styles.opacityRow}>
          <span style={styles.opacityLabel}>Opacité</span>
          <input type="range" min={10} max={100} step={5}
            value={Math.round(opacity * 100)}
            onChange={e => onOpacityChange(+e.target.value / 100)}
            style={styles.opacitySlider} />
          <span style={styles.opacityValue}>{Math.round(opacity * 100)}%</span>
        </div>
      )}

      {expanded && (
        <HslColorPicker color={color} onChange={onColorChange} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: '#fff', borderBottom: '1px solid #e8e8e8', flexShrink: 0 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px' },
  sizeBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 2px', flex: 1, height: 44 },
  colorBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, flex: 1, display: 'flex', justifyContent: 'center' },
  chevronBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px', display: 'flex', alignItems: 'center' },
  opacityRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderTop: '1px solid #f0f0f0' },
  opacityLabel: { fontSize: 12, color: '#666', flexShrink: 0 },
  opacitySlider: { flex: 1, cursor: 'pointer', accentColor: '#118ab2' },
  opacityValue: { fontSize: 11, color: '#888', width: 34, textAlign: 'right' as const, flexShrink: 0 },
};
