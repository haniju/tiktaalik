import React from 'react';
import { GridSettings, GridStyle, DEFAULT_GRID_SETTINGS } from '../types';

interface Props {
  settings: GridSettings;
  onChange: (settings: GridSettings) => void;
  onClose: () => void;
}

const STYLE_OPTIONS: { value: GridStyle; label: string }[] = [
  { value: 'dots', label: 'Points' },
  { value: 'lines', label: 'Tracés' },
  { value: 'checkerboard', label: 'Damier' },
];

const SPACING_PRESETS = [10, 15, 20, 30, 40, 50];

export function GridSettingsPanel({ settings, onChange, onClose }: Props) {
  const update = (patch: Partial<GridSettings>) => onChange({ ...settings, ...patch });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>Réglages grille</span>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Style */}
        <div style={styles.section}>
          <span style={styles.label}>Style</span>
          <div style={styles.segmented}>
            {STYLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                style={{
                  ...styles.segBtn,
                  ...(settings.style === opt.value ? styles.segBtnActive : {}),
                }}
                onClick={() => update({ style: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Espacement */}
        <div style={styles.section}>
          <div style={styles.sliderHeader}>
            <span style={styles.label}>Espacement</span>
            <span style={styles.value}>{settings.spacing}px</span>
          </div>
          <input
            type="range" className="app-slider"
            min={5} max={80} step={1}
            value={settings.spacing}
            onChange={e => update({ spacing: +e.target.value })}
          />
          <div style={styles.presets}>
            {SPACING_PRESETS.map(v => (
              <button
                key={v}
                style={{
                  ...styles.presetBtn,
                  ...(settings.spacing === v ? styles.presetBtnActive : {}),
                }}
                onClick={() => update({ spacing: v })}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Opacité */}
        <div style={styles.section}>
          <div style={styles.sliderHeader}>
            <span style={styles.label}>Opacité</span>
            <span style={styles.value}>{Math.round(settings.opacity * 100)}%</span>
          </div>
          <input
            type="range" className="app-slider"
            min={5} max={100} step={5}
            value={Math.round(settings.opacity * 100)}
            onChange={e => update({ opacity: +e.target.value / 100 })}
          />
        </div>

        {/* Couleur */}
        <div style={styles.section}>
          <span style={styles.label}>Couleur</span>
          <div style={styles.colorRow}>
            {COLORS.map(c => (
              <button
                key={c}
                style={{
                  ...styles.colorSwatch,
                  background: c,
                  border: settings.color === c ? '2.5px solid #222' : '2px solid transparent',
                }}
                onClick={() => update({ color: c })}
              />
            ))}
          </div>
        </div>

        {/* Reset */}
        <button style={styles.resetBtn} onClick={() => onChange({ ...DEFAULT_GRID_SETTINGS })}>
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

const COLORS = [
  '#e63946', // rouge (défaut)
  '#f4a261', // orange
  '#e9c46a', // jaune
  '#2a9d8f', // teal
  '#118ab2', // bleu
  '#6c63ff', // violet
  '#000000', // noir
  '#888888', // gris
];

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
  },
  panel: {
    background: '#fff', borderRadius: 16, padding: 20, width: 300,
    maxHeight: '80vh', overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: 600, color: '#1a1a1a' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 24, color: '#888',
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  section: { marginBottom: 16 },
  label: { fontSize: 13, color: '#555', fontWeight: 500 },
  sliderHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  value: { fontSize: 12, color: '#888' },
  segmented: {
    display: 'flex', gap: 0, marginTop: 8, borderRadius: 8, overflow: 'hidden',
    border: '1px solid #ddd',
  },
  segBtn: {
    flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 500,
    background: '#f8f8f8', border: 'none', cursor: 'pointer',
    color: '#555', transition: 'background 0.15s',
  },
  segBtnActive: {
    background: '#118ab2', color: '#fff',
  },
  presets: {
    display: 'flex', gap: 6, marginTop: 8,
  },
  presetBtn: {
    flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 500,
    background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 6,
    cursor: 'pointer', color: '#666',
  },
  presetBtnActive: {
    background: '#118ab2', color: '#fff', borderColor: '#118ab2',
  },
  colorRow: {
    display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
    boxSizing: 'border-box',
  },
  resetBtn: {
    width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 500,
    background: '#f8f8f8', border: '1px solid #ddd', borderRadius: 8,
    cursor: 'pointer', color: '#888', marginTop: 4,
  },
};
