import { useState } from 'react';
import { DrawingTool } from '../types';
import { HslColorPicker } from './HslColorPicker';

interface Props {
  tool: DrawingTool;
  color: string;
  width: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
}

const SIZES = [1, 2, 4, 7, 11, 18, 28];
const PRESET_COLORS = ['#e63946', '#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5'];

export function DrawingPanel({ color, width, onColorChange, onWidthChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={styles.root}>
      {/* Tailles */}
      <div style={styles.row}>
        {SIZES.map(s => (
          <button key={s} style={styles.sizeBtn} onClick={() => onWidthChange(s)}>
            <div style={{
              width: Math.min(s * 2.4, 36), height: Math.min(s * 2.4, 36),
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
          <img src={expanded ? '/icons/less.svg' : '/icons/more.svg'} width={20} height={20} alt="" />
        </button>
      </div>

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
  expandedRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderTop: '1px solid #f0f0f0' },
  expandLabel: { fontSize: 13, color: '#555' },
};
