import React from 'react';

interface Props {
  opacity: number;                      // 0-1
  onChange: (value: number) => void;     // pendant le drag (preview live)
  onChangeEnd: (value: number) => void;  // au relâchement (pour undo)
  onClose: () => void;                  // fermeture via overlay
}

export function ImageOpacityPanel({ opacity, onChange, onChangeEnd, onClose }: Props) {
  const pct = Math.round(opacity * 100);

  return (
    <>
      {/* Overlay de fermeture */}
      <div
        style={st.overlay}
        onClick={onClose}
        onTouchEnd={e => { e.preventDefault(); onClose(); }}
      />

      {/* Panneau */}
      <div style={st.panel}>
        <div style={st.header}>
          <span style={st.label}>Opacité</span>
          <span style={st.value}>{pct}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={100}
          step={5}
          value={pct}
          onChange={e => onChange(Number(e.target.value) / 100)}
          onMouseUp={e => onChangeEnd(Number((e.target as HTMLInputElement).value) / 100)}
          onTouchEnd={e => onChangeEnd(Number((e.target as HTMLInputElement).value) / 100)}
          style={st.slider}
        />
      </div>
    </>
  );
}

const st: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 300,
  },
  panel: {
    position: 'fixed',
    top: 60,
    left: 12,
    zIndex: 301,
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
    padding: '12px 16px',
    minWidth: 200,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#333',
  },
  value: {
    fontSize: 13,
    color: '#888',
    fontVariantNumeric: 'tabular-nums',
  },
  slider: {
    width: '100%',
    margin: 0,
  },
};
