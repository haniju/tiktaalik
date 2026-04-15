import { useState } from 'react';
import { HslColorPicker } from './HslColorPicker';

const DRAWING_PRESETS = ['#e63946', '#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#000000', '#ffffff'];
const BACKGROUND_PRESETS = ['#ffffff', '#f5f0e8', '#fef9ef', '#e8f4f8', '#f0ede6', '#1a1a2e', '#2d3748', '#000000'];

export type ColorPickerMode = 'drawing' | 'background' | 'text';

interface Props {
  color: string;
  onChange: (color: string) => void;
  mode: ColorPickerMode;
}

function presetsForMode(mode: ColorPickerMode): string[] {
  return mode === 'background' ? BACKGROUND_PRESETS : DRAWING_PRESETS;
}

export function UnifiedColorPicker({ color, onChange, mode }: Props) {
  const [expanded, setExpanded] = useState(false);
  const presets = presetsForMode(mode);

  return (
    <div style={styles.root}>
      <div style={styles.row}>
        {presets.map(c => (
          <button key={c} style={styles.colorBtn} onClick={() => onChange(c)}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: c,
              border: color === c ? '2.5px solid #222' : c === '#ffffff' ? '2px solid #ddd' : '2px solid transparent',
              boxSizing: 'border-box',
            }} />
          </button>
        ))}
        <button style={styles.chevronBtn} onClick={() => setExpanded(p => !p)}>
          <img src={expanded ? '/icons/more.svg' : '/icons/less.svg'} width={20} height={20} alt="" />
        </button>
      </div>

      {expanded && (
        <HslColorPicker color={color} onChange={onChange} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: '#fff', flexShrink: 0 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px' },
  colorBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, flex: 1, display: 'flex', justifyContent: 'center' },
  chevronBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px', display: 'flex', alignItems: 'center' },
};
