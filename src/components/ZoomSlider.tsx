import React from 'react';

const MIN = 30;
const MAX = 400;

interface Props {
  value: number;
  onChange: (pct: number) => void;
}

export function ZoomSlider({ value, onChange }: Props) {
  const clamped = Math.min(MAX, Math.max(MIN, value));

  return (
    <div style={styles.root}>
      <span style={styles.label}>{clamped}%</span>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={5}
        value={clamped}
        onChange={e => onChange(Number(e.target.value))}
        style={styles.slider}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    bottom: 72,         // au-dessus des FABs (bottom:16 + height:44 + gap:12)
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    padding: '6px 14px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.13)',
    zIndex: 90,
    userSelect: 'none',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#444',
    minWidth: 38,
    textAlign: 'right' as const,
  },
  slider: {
    width: 160,
    cursor: 'pointer',
    accentColor: '#118ab2',
  },
};
