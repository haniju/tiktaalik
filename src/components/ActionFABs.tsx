import { CanvasMode } from '../types';
import { Icon } from './Icon';

interface Props {
  canvasMode: CanvasMode;
  isDirty: boolean;
  isSaving: boolean;
  onSetMode: (mode: CanvasMode) => void;
  onSave: () => void;
}

export function ActionFABs({ canvasMode, isDirty, isSaving, onSetMode, onSave }: Props) {
  return (
    <div data-fabs style={styles.root}>
      {/* Mode select */}
      <button
        style={{ ...styles.fab, ...(canvasMode === 'select' ? styles.fabActive : {}) }}
        onClick={() => onSetMode(canvasMode === 'select' ? 'draw' : 'select')}
        title="Sélectionner"
      >
        <Icon name="select" size={20} style={{ opacity: canvasMode === 'select' ? 0.9 : 0.6 }} />
      </button>

      {/* Mode move */}
      <button
        style={{ ...styles.fab, ...(canvasMode === 'move' ? styles.fabActive : {}) }}
        onClick={() => onSetMode(canvasMode === 'move' ? 'draw' : 'move')}
        title="Déplacer"
      >
        <Icon name="drag" size={20} style={{ opacity: canvasMode === 'move' ? 0.9 : 0.6 }} />
      </button>

      {/* Sauvegarde */}
      <button
        style={{ ...styles.fab, ...(isDirty ? styles.fabDirty : styles.fabClean) }}
        onClick={onSave}
        disabled={isSaving}
        title="Sauvegarder"
      >
        <Icon name="save" size={20} />
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 16,
    display: 'flex',
    flexDirection: 'row',
    gap: 10,
    zIndex: 100,
  },
  fab: {
    width: 44, height: 44,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#fff',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    transition: 'background 0.15s',
  },
  fabActive: {
    background: '#333',
  },
  fabDirty: {
    background: '#e63946',
  },
  fabClean: {
    background: '#aaa',
  },
};
