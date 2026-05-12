import { ButtonMapping, MappableAction } from '../hooks/useButtonMapping';

interface Props {
  mappings: ButtonMapping[];
  listening: boolean;
  actionLabels: Record<MappableAction, string>;
  onStartListening: () => void;
  onStopListening: () => void;
  onSetAction: (index: number, action: MappableAction | null) => void;
  onRemoveMapping: (index: number) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export function ButtonMappingModal({
  mappings, listening, actionLabels,
  onStartListening, onStopListening,
  onSetAction, onRemoveMapping, onClearAll, onClose,
}: Props) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Mapping boutons</span>
          <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Zone détection */}
        <div style={styles.section}>
          {listening ? (
            <div>
              <p style={styles.hint}>Appuyez sur les boutons physiques...</p>
              <div style={styles.pulse} />
              <button style={styles.actionBtn} onClick={onStopListening}>Terminer la détection</button>
            </div>
          ) : (
            <button style={styles.actionBtn} onClick={onStartListening}>Détecter les boutons</button>
          )}
        </div>

        {/* Liste des boutons détectés */}
        {mappings.length > 0 && (
          <div style={styles.section}>
            <div style={styles.listHeader}>
              <span style={styles.sectionTitle}>Boutons détectés ({mappings.length})</span>
              <button style={styles.clearBtn} onClick={onClearAll}>Tout effacer</button>
            </div>
            <div style={styles.list}>
              {mappings.map((m, i) => (
                <div key={`${m.key}:${m.code}:${m.keyCode}`} style={styles.row}>
                  <div style={styles.rowLeft}>
                    <span style={styles.keyBadge}>{m.label}</span>
                    <span style={styles.keyDetail}>{m.code}</span>
                  </div>
                  <div style={styles.rowRight}>
                    <select
                      style={styles.select}
                      value={m.action ?? ''}
                      onChange={e => onSetAction(i, (e.target.value || null) as MappableAction | null)}
                    >
                      <option value="">Aucun</option>
                      {Object.entries(actionLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <button style={styles.removeBtn} onClick={() => onRemoveMapping(i)}>&times;</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mappings.length === 0 && !listening && (
          <p style={styles.empty}>Aucun bouton détecté. Lancez la détection pour commencer.</p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 16, width: '90%', maxWidth: 400,
    maxHeight: '80vh', overflowY: 'auto',
    boxShadow: '0 8px 40px rgba(0,0,0,0.25)', padding: 20,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 24, color: '#999',
    cursor: 'pointer', padding: '0 4px', lineHeight: 1,
  },
  section: { marginBottom: 16 },
  hint: {
    fontSize: 14, color: '#666', textAlign: 'center' as const, marginBottom: 12,
  },
  pulse: {
    width: 16, height: 16, borderRadius: '50%', background: '#e63946',
    margin: '0 auto 12px', animation: 'pulse 1.2s ease-in-out infinite',
  },
  actionBtn: {
    display: 'block', width: '100%', padding: '10px 16px', fontSize: 15,
    fontWeight: 600, color: '#fff', background: '#118ab2', border: 'none',
    borderRadius: 10, cursor: 'pointer',
  },
  listHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#555' },
  clearBtn: {
    background: 'none', border: 'none', fontSize: 13, color: '#e63946',
    cursor: 'pointer', textDecoration: 'underline',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#f8f8f8', borderRadius: 10, padding: '8px 12px',
  },
  rowLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  keyBadge: {
    fontSize: 13, fontWeight: 700, color: '#1a1a1a', background: '#e8e8e8',
    borderRadius: 6, padding: '3px 8px',
  },
  keyDetail: { fontSize: 11, color: '#999' },
  rowRight: { display: 'flex', alignItems: 'center', gap: 6 },
  select: {
    fontSize: 13, padding: '4px 8px', borderRadius: 6,
    border: '1px solid #ddd', background: '#fff', color: '#333',
  },
  removeBtn: {
    background: 'none', border: 'none', fontSize: 18, color: '#ccc',
    cursor: 'pointer', padding: '0 2px', lineHeight: 1,
  },
  empty: { fontSize: 14, color: '#999', textAlign: 'center' as const },
};
