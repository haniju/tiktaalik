import { Icon } from './Icon';

interface Props {
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export function SaveFAB({ onSave, isSaving, isDirty }: Props) {
  return (
    <button
      style={{ ...styles.fab, opacity: isSaving ? 0.6 : 1, transform: isDirty ? 'scale(1)' : 'scale(0.9)' }}
      onClick={onSave}
      disabled={isSaving}
      title="Sauvegarder"
    >
      <Icon name="save" size={24} style={{ filter: 'invert(1)' }} />
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed', bottom: 28, left: 20,
    width: 52, height: 52, borderRadius: '50%',
    background: '#e63946', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(230,57,70,0.35)',
    transition: 'opacity 0.2s, transform 0.2s', zIndex: 100,
  },
};
