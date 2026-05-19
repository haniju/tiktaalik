import { useState } from 'react';
import type { ExportFormat } from '../utils/export';

export interface ExportOptions {
  format: ExportFormat;
  transparent: boolean;
}

interface Props {
  onExport: (options: ExportOptions) => void;
  onPrint: () => void;
  onClose: () => void;
}

const FORMAT_OPTIONS: { format: ExportFormat; label: string; desc: string }[] = [
  { format: 'png', label: 'PNG', desc: 'Image sans perte' },
  { format: 'jpeg', label: 'JPG', desc: 'Léger, idéal pour partager' },
  { format: 'webp', label: 'WebP', desc: 'Bonne qualité, fichier compact' },
  { format: 'svg', label: 'SVG', desc: 'Vectoriel, qualité parfaite à toute taille' },
];

export function ExportModal({ onExport, onPrint, onClose }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [transparent, setTransparent] = useState(false);

  const handleExport = () => {
    onExport({ format: selectedFormat, transparent: selectedFormat === 'png' && transparent });
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Exporter</span>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div style={styles.divider} />

        <div style={styles.list}>
          {FORMAT_OPTIONS.map(opt => {
            const selected = opt.format === selectedFormat;
            return (
              <button
                key={opt.format}
                style={{
                  ...styles.formatBtn,
                  ...(selected ? styles.formatBtnSelected : {}),
                }}
                onClick={() => setSelectedFormat(opt.format)}
              >
                <span style={styles.formatLabel}>{opt.label}</span>
                <span style={styles.formatDesc}>{opt.desc}</span>
              </button>
            );
          })}
        </div>

        {selectedFormat === 'png' && (
          <>
            <div style={styles.divider} />
            <label style={styles.optionRow}>
              <input
                type="checkbox"
                checked={transparent}
                onChange={e => setTransparent(e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.optionLabel}>Fond transparent</span>
            </label>
          </>
        )}

        <div style={styles.divider} />

        <button style={styles.exportBtn} onClick={handleExport}>
          Exporter en {FORMAT_OPTIONS.find(o => o.format === selectedFormat)!.label}
        </button>

        <button
          style={styles.printBtn}
          onClick={() => { onPrint(); onClose(); }}
        >
          Imprimer
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: '#fff', borderRadius: 16, width: '90%', maxWidth: 360,
    boxShadow: '0 8px 40px rgba(0,0,0,0.25)', padding: 20,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 24, color: '#999',
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  divider: { height: 1, background: '#e8e8e8', margin: '14px 0' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  formatBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    background: '#f8f8f8', border: '2px solid #e8e8e8', borderRadius: 10,
    padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
    transition: 'background 0.15s, border-color 0.15s',
  },
  formatBtnSelected: {
    background: '#e8f4fd', borderColor: '#118ab2',
  },
  formatLabel: { fontSize: 15, fontWeight: 600, color: '#1a1a1a' },
  formatDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  optionRow: {
    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
    padding: '4px 0',
  },
  checkbox: {
    width: 20, height: 20, accentColor: '#118ab2', cursor: 'pointer',
  },
  optionLabel: { fontSize: 14, fontWeight: 500, color: '#1a1a1a' },
  exportBtn: {
    display: 'block', width: '100%', padding: '12px 16px', fontSize: 15,
    fontWeight: 600, color: '#fff', background: '#118ab2',
    border: 'none', borderRadius: 10, cursor: 'pointer',
    marginBottom: 8,
  },
  printBtn: {
    display: 'block', width: '100%', padding: '12px 16px', fontSize: 15,
    fontWeight: 600, color: '#118ab2', background: 'none',
    border: '2px solid #118ab2', borderRadius: 10, cursor: 'pointer',
  },
};
