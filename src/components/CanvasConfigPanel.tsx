import React from 'react';
import { CanvasConfig, CanvasUnit, DEFAULT_CANVAS_CONFIG } from '../types';
import { pxToCm, cmToPx } from '../utils/canvasConfig';

interface Props {
  config: CanvasConfig;
  onChange: (config: CanvasConfig) => void;
  onClose: () => void;
}

const PRESETS: { label: string; width: number; height: number }[] = [
  { label: 'A4', width: 794, height: 1123 },
  { label: 'A3', width: 1123, height: 1587 },
  { label: 'Letter', width: 816, height: 1056 },
];

const UNIT_OPTIONS: { value: CanvasUnit; label: string }[] = [
  { value: 'px', label: 'px' },
  { value: 'cm', label: 'cm' },
];

const MULTIPLIER_OPTIONS = [1, 2, 3, 4, 5];

function matchesPreset(config: CanvasConfig): string | null {
  const p = PRESETS.find(p => p.width === config.canvasWidth && p.height === config.canvasHeight);
  return p ? p.label : null;
}

function displayValue(px: number, unit: CanvasUnit): string {
  return unit === 'cm' ? pxToCm(px).toFixed(1) : String(px);
}

function parseInput(value: string, unit: CanvasUnit): number {
  const n = parseFloat(value);
  if (isNaN(n) || n <= 0) return 0;
  return unit === 'cm' ? cmToPx(n) : Math.round(n);
}

export function CanvasConfigPanel({ config, onChange, onClose }: Props) {
  const update = (patch: Partial<CanvasConfig>) => onChange({ ...config, ...patch });
  const activePreset = matchesPreset(config);
  const unit = config.displayUnit;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>Format canevas</span>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Unité */}
        <div style={styles.section}>
          <span style={styles.label}>Unité</span>
          <div style={styles.segmented}>
            {UNIT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                style={{
                  ...styles.segBtn,
                  ...(unit === opt.value ? styles.segBtnActive : {}),
                }}
                onClick={() => update({ displayUnit: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div style={styles.section}>
          <span style={styles.label}>Taille du canevas</span>
          <div style={styles.segmented}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                style={{
                  ...styles.segBtn,
                  ...(activePreset === p.label ? styles.segBtnActive : {}),
                }}
                onClick={() => update({ canvasWidth: p.width, canvasHeight: p.height })}
              >
                {p.label}
              </button>
            ))}
            <button
              style={{
                ...styles.segBtn,
                ...(activePreset === null ? styles.segBtnActive : {}),
              }}
              onClick={() => {/* déjà en mode libre */}}
            >
              Libre
            </button>
          </div>
        </div>

        {/* Dimensions */}
        <div style={styles.section}>
          <div style={styles.dimRow}>
            <div style={styles.dimField}>
              <span style={styles.dimLabel}>Largeur</span>
              <input
                type="number"
                style={styles.dimInput}
                value={displayValue(config.canvasWidth, unit)}
                min={1}
                onChange={e => {
                  const v = parseInput(e.target.value, unit);
                  if (v > 0) update({ canvasWidth: v });
                }}
              />
              <span style={styles.dimUnit}>{unit}</span>
            </div>
            <span style={styles.dimSep}>&times;</span>
            <div style={styles.dimField}>
              <span style={styles.dimLabel}>Hauteur</span>
              <input
                type="number"
                style={styles.dimInput}
                value={displayValue(config.canvasHeight, unit)}
                min={1}
                onChange={e => {
                  const v = parseInput(e.target.value, unit);
                  if (v > 0) update({ canvasHeight: v });
                }}
              />
              <span style={styles.dimUnit}>{unit}</span>
            </div>
          </div>
        </div>

        {/* Zone monde — multiplicateur */}
        <div style={styles.section}>
          <div style={styles.sliderHeader}>
            <span style={styles.label}>Zone monde</span>
            <span style={styles.value}>{config.worldMultiplier}×</span>
          </div>
          <div style={styles.segmented}>
            {MULTIPLIER_OPTIONS.map(m => (
              <button
                key={m}
                style={{
                  ...styles.segBtn,
                  ...(config.worldMultiplier === m ? styles.segBtnActive : {}),
                }}
                onClick={() => update({ worldMultiplier: m })}
              >
                {m}×
              </button>
            ))}
          </div>
        </div>

        {/* Reset */}
        <button style={styles.resetBtn} onClick={() => onChange({ ...DEFAULT_CANVAS_CONFIG })}>
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

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
  dimRow: {
    display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 8,
  },
  dimField: {
    flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4,
  },
  dimLabel: { fontSize: 11, color: '#888' },
  dimInput: {
    width: '100%', padding: '6px 8px', fontSize: 14,
    border: '1px solid #ddd', borderRadius: 6,
    boxSizing: 'border-box' as const,
    textAlign: 'right' as const,
  },
  dimUnit: { fontSize: 11, color: '#aaa', textAlign: 'right' as const },
  dimSep: {
    fontSize: 16, color: '#aaa', paddingBottom: 20, alignSelf: 'flex-end' as const,
  },
  resetBtn: {
    width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 500,
    background: '#f8f8f8', border: '1px solid #ddd', borderRadius: 8,
    cursor: 'pointer', color: '#888', marginTop: 4,
  },
};
