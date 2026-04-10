const PRESETS = ['#ffffff', '#f5f0e8', '#fef9ef', '#e8f4f8', '#f0ede6', '#1a1a2e', '#2d3748', '#000000'];

interface Props {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPickerPanel({ color, onChange }: Props) {
  return (
    <div style={styles.root}>
      <div style={styles.row}>
        {PRESETS.map(c => (
          <button key={c} style={styles.colorBtn} onClick={() => onChange(c)}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: c,
              border: color === c ? '2.5px solid #222' : c === '#ffffff' ? '2px solid #ddd' : '2px solid transparent',
              boxSizing: 'border-box',
            }} />
          </button>
        ))}
        <label style={styles.colorBtn}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', border: '2px solid #e8e8e8' }} />
          <input type="color" value={color} onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 28, height: 28, cursor: 'pointer' }} />
        </label>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: '#fff', flexShrink: 0 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px' },
  colorBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, flex: 1, display: 'flex', justifyContent: 'center', position: 'relative' },
};
