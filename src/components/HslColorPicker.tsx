import { useState, useRef, useEffect } from 'react';

interface Props {
  color: string;
  onChange: (color: string) => void;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const SLIDER_CSS = `
.hsl-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 24px;
  background: transparent;
  margin: 0;
  cursor: pointer;
}
.hsl-slider::-webkit-slider-runnable-track {
  height: 24px;
  background: transparent;
  border-radius: 12px;
}
.hsl-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #444;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  margin-top: 0;
}
.hsl-slider::-moz-range-track {
  height: 24px;
  background: transparent;
  border-radius: 12px;
}
.hsl-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #444;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}
`;

export function HslColorPicker({ color, onChange }: Props) {
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(color));
  const lastHexRef = useRef(color);

  // Sync quand la couleur change depuis l'extérieur (preset)
  useEffect(() => {
    if (color !== lastHexRef.current) {
      setHsl(hexToHsl(color));
      lastHexRef.current = color;
    }
  }, [color]);

  const update = (index: 0 | 1 | 2, value: number) => {
    const next: [number, number, number] = [...hsl];
    next[index] = value;
    setHsl(next);
    const hex = hslToHex(next[0], next[1], next[2]);
    lastHexRef.current = hex;
    onChange(hex);
  };

  const [h, s, l] = hsl;

  return (
    <div style={styles.root}>
      <style>{SLIDER_CSS}</style>

      {/* Teinte */}
      <div style={styles.sliderRow}>
        <span style={styles.label}>T</span>
        <div style={{
          ...styles.trackBg,
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}>
          <input type="range" className="hsl-slider" min={0} max={360} value={h}
            onChange={e => update(0, +e.target.value)} />
        </div>
        <span style={styles.value}>{h}°</span>
      </div>

      {/* Saturation */}
      <div style={styles.sliderRow}>
        <span style={styles.label}>S</span>
        <div style={{
          ...styles.trackBg,
          background: `linear-gradient(to right, hsl(${h},0%,${l}%), hsl(${h},100%,${l}%))`,
        }}>
          <input type="range" className="hsl-slider" min={0} max={100} value={s}
            onChange={e => update(1, +e.target.value)} />
        </div>
        <span style={styles.value}>{s}%</span>
      </div>

      {/* Luminosité */}
      <div style={styles.sliderRow}>
        <span style={styles.label}>L</span>
        <div style={{
          ...styles.trackBg,
          background: `linear-gradient(to right, #000, hsl(${h},${s}%,50%), #fff)`,
        }}>
          <input type="range" className="hsl-slider" min={0} max={100} value={l}
            onChange={e => update(2, +e.target.value)} />
        </div>
        <span style={styles.value}>{l}%</span>
      </div>

      {/* Aperçu */}
      <div style={styles.previewRow}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: color, border: '2px solid #e8e8e8',
          flexShrink: 0,
        }} />
        <span style={styles.hexLabel}>{color.toUpperCase()}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    padding: '6px 12px 8px',
    borderTop: '1px solid #f0f0f0',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#666',
    width: 14,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  trackBg: {
    flex: 1,
    height: 24,
    borderRadius: 12,
    position: 'relative' as const,
    overflow: 'hidden',
    border: '1px solid #ddd',
  },
  value: {
    fontSize: 11,
    color: '#888',
    width: 32,
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  previewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  hexLabel: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#555',
  },
};
