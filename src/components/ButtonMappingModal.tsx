import { useState } from 'react';
import {
  ButtonMapping, MappingBinding, GestureType, ActionType, MappableMode,
  GESTURE_LABELS, ACTION_TYPE_LABELS, MODE_LABELS,
} from '../hooks/useButtonMapping';

interface Props {
  mappings: ButtonMapping[];
  listening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onAddBinding: (buttonIndex: number, binding: MappingBinding) => void;
  onRemoveBinding: (buttonIndex: number, gesture: GestureType) => void;
  onRemoveMapping: (index: number) => void;
  onClearAll: () => void;
  onClose: () => void;
}

const GESTURES: GestureType[] = ['click', 'hold', 'double_click'];
const ACTION_TYPES: ActionType[] = ['toggle', 'toggle_and_release'];
const MODES: MappableMode[] = ['select', 'pan'];

function isValidCombo(gesture: GestureType, actionType: ActionType): boolean {
  // toggle_and_release uniquement avec hold
  if (actionType === 'toggle_and_release' && gesture !== 'hold') return false;
  return true;
}

export function ButtonMappingModal({
  mappings, listening,
  onStartListening, onStopListening,
  onAddBinding, onRemoveBinding, onRemoveMapping, onClearAll, onClose,
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
                <ButtonCard
                  key={`${m.key}:${m.code}:${m.keyCode}`}
                  mapping={m}
                  index={i}
                  onAddBinding={onAddBinding}
                  onRemoveBinding={onRemoveBinding}
                  onRemoveMapping={onRemoveMapping}
                />
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

// ─── Card par bouton ─────────────────────────────────────────────────────────

interface CardProps {
  mapping: ButtonMapping;
  index: number;
  onAddBinding: (buttonIndex: number, binding: MappingBinding) => void;
  onRemoveBinding: (buttonIndex: number, gesture: GestureType) => void;
  onRemoveMapping: (index: number) => void;
}

function ButtonCard({ mapping, index, onAddBinding, onRemoveBinding, onRemoveMapping }: CardProps) {
  const [adding, setAdding] = useState(false);

  const usedGestures = new Set(mapping.bindings.map(b => b.gesture));
  const availableGestures = GESTURES.filter(g => !usedGestures.has(g));

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.rowLeft}>
          <span style={styles.keyBadge}>{mapping.label}</span>
          <span style={styles.keyDetail}>{mapping.code || `keyCode: ${mapping.keyCode}`}</span>
        </div>
        <button style={styles.removeBtn} onClick={() => onRemoveMapping(index)} title="Supprimer le bouton">&times;</button>
      </div>

      {/* Bindings existants */}
      {mapping.bindings.map(b => (
        <div key={b.gesture} style={styles.bindingRow}>
          <span style={styles.bindingChip}>{GESTURE_LABELS[b.gesture]}</span>
          <span style={styles.bindingArrow}>&rarr;</span>
          <span style={styles.bindingChip}>{ACTION_TYPE_LABELS[b.actionType]}</span>
          <span style={styles.bindingChip}>{MODE_LABELS[b.mode]}</span>
          <button style={styles.removeBtnSmall} onClick={() => onRemoveBinding(index, b.gesture)}>&times;</button>
        </div>
      ))}

      {/* Ajout d'un binding */}
      {adding ? (
        <AddBindingForm
          availableGestures={availableGestures}
          onConfirm={(binding) => { onAddBinding(index, binding); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        availableGestures.length > 0 && (
          <button style={styles.addBtn} onClick={() => setAdding(true)}>+ Ajouter un geste</button>
        )
      )}
    </div>
  );
}

// ─── Formulaire d'ajout de binding ───────────────────────────────────────────

interface AddFormProps {
  availableGestures: GestureType[];
  onConfirm: (binding: MappingBinding) => void;
  onCancel: () => void;
}

function AddBindingForm({ availableGestures, onConfirm, onCancel }: AddFormProps) {
  const [gesture, setGesture] = useState<GestureType>(availableGestures[0]);
  const [actionType, setActionType] = useState<ActionType>('toggle');
  const [mode, setMode] = useState<MappableMode>('pan');

  // Corriger actionType si le combo n'est pas valide
  const correctedAction = isValidCombo(gesture, actionType) ? actionType : 'toggle';

  return (
    <div style={styles.addForm}>
      <div style={styles.addFormSelects}>
        <select
          style={styles.select}
          value={gesture}
          onChange={e => {
            const g = e.target.value as GestureType;
            setGesture(g);
            // Reset action si incompatible
            if (!isValidCombo(g, actionType)) setActionType('toggle');
          }}
        >
          {availableGestures.map(g => (
            <option key={g} value={g}>{GESTURE_LABELS[g]}</option>
          ))}
        </select>

        <select
          style={styles.select}
          value={correctedAction}
          onChange={e => setActionType(e.target.value as ActionType)}
        >
          {ACTION_TYPES.map(a => (
            <option key={a} value={a} disabled={!isValidCombo(gesture, a)}>
              {ACTION_TYPE_LABELS[a]}
            </option>
          ))}
        </select>

        <select
          style={styles.select}
          value={mode}
          onChange={e => setMode(e.target.value as MappableMode)}
        >
          {MODES.map(m => (
            <option key={m} value={m}>{MODE_LABELS[m]}</option>
          ))}
        </select>
      </div>

      <div style={styles.addFormActions}>
        <button style={styles.confirmBtn} onClick={() => onConfirm({ gesture, actionType: correctedAction, mode })}>OK</button>
        <button style={styles.cancelBtn} onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 16, width: '90%', maxWidth: 420,
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
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: '#f8f8f8', borderRadius: 12, padding: '10px 12px',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  keyBadge: {
    fontSize: 13, fontWeight: 700, color: '#1a1a1a', background: '#e8e8e8',
    borderRadius: 6, padding: '3px 8px',
  },
  keyDetail: { fontSize: 11, color: '#999' },
  removeBtn: {
    background: 'none', border: 'none', fontSize: 18, color: '#ccc',
    cursor: 'pointer', padding: '0 2px', lineHeight: 1,
  },
  removeBtnSmall: {
    background: 'none', border: 'none', fontSize: 15, color: '#ccc',
    cursor: 'pointer', padding: '0 2px', lineHeight: 1, marginLeft: 'auto',
  },
  bindingRow: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
    flexWrap: 'wrap' as const,
  },
  bindingChip: {
    fontSize: 12, fontWeight: 500, background: '#e0ecf4', color: '#1a6b8a',
    borderRadius: 5, padding: '2px 7px',
  },
  bindingArrow: { fontSize: 12, color: '#999' },
  addBtn: {
    marginTop: 6, background: 'none', border: '1px dashed #bbb',
    borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#666',
    cursor: 'pointer', width: '100%',
  },
  addForm: {
    marginTop: 8, background: '#fff', borderRadius: 8, padding: 8,
    border: '1px solid #ddd',
  },
  addFormSelects: {
    display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 8,
  },
  select: {
    fontSize: 12, padding: '4px 6px', borderRadius: 6,
    border: '1px solid #ddd', background: '#fff', color: '#333', flex: '1 1 auto',
    minWidth: 80,
  },
  addFormActions: { display: 'flex', gap: 6 },
  confirmBtn: {
    fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
    border: 'none', background: '#118ab2', color: '#fff', cursor: 'pointer',
  },
  cancelBtn: {
    fontSize: 12, padding: '5px 12px', borderRadius: 6,
    border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer',
  },
  empty: { fontSize: 14, color: '#999', textAlign: 'center' as const },
};
