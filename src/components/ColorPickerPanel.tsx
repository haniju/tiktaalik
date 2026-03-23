const PRESETS = ['#ffffff', '#f5f0e8', '#fef9ef', '#e8f4f8', '#f0ede6', '#1a1a2e', '#2d3748', '#000000'];

interface Props {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPickerPanel({ color, onChange }: Props) {
  return (
    <div style={styles.root}>
      <div style={styles.row}>
        <span style={styles.label}>Fond du canvas</span>
        {PRESETS.map(c => (
          <button key={c} style={styles.btn} onClick={() => onChange(c)}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: c,
              border: color === c ? '3px solid #222' : c === '#ffffff' ? '2px solid #ddd' : '2px solid transparent',
              boxSizing: 'border-box',
            }} />
          </button>
        ))}
        <label style={{ cursor: 'pointer', display: 'flex', padding: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', border: '2px solid #e8e8e8' }} />
          <input type="color" value={color} onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 28, height: 28, cursor: 'pointer' }} />
        </label>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: '#fff', borderBottom: '1px solid #e8e8e8', flexShrink: 0 },
  row: { display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 6, overflowX: 'auto' },
  label: { fontSize: 12, color: '#888', marginRight: 4, flexShrink: 0 },
  btn: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 },
};
