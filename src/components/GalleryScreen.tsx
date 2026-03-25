import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Drawing } from '../types';
import { useDrawingStorage } from '../hooks/useDrawingStorage';

interface Props {
  onOpen: (drawing: Drawing) => void;
  onNew: (drawing: Drawing) => void;
}

function newDrawing(): Drawing {
  return {
    id: uuidv4(),
    name: 'Sans titre',
    layers: [],
    background: '#ffffff',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function GalleryScreen({ onOpen, onNew }: Props) {
  const storage = useDrawingStorage();
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => { setDrawings(storage.getAll()); }, []);

  const handleNew = () => { const d = newDrawing(); onNew(d); };

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer ce dessin ?')) return;
    storage.remove(id);
    setDrawings(storage.getAll());
  };

  const handleRename = (id: string) => {
    if (!renameValue.trim()) return;
    storage.rename(id, renameValue.trim());
    setDrawings(storage.getAll());
    setRenamingId(null);
  };


  return (
    <div style={styles.root}>
      <div style={styles.topBar}>
        <span style={styles.title}>Mes dessins</span>
        <button style={styles.newBtn} onClick={handleNew}>+ Nouveau</button>
      </div>

      {drawings.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Aucun dessin</p>
          <button style={styles.newBtnLarge} onClick={handleNew}>Créer un dessin</button>
        </div>
      ) : (
        <div style={styles.grid}>
          {drawings.map(d => (
            <div key={d.id} style={styles.card} onClick={() => onOpen(d)}>
              {/* Vignette */}
              <div style={styles.thumbnail}>
                {d.thumbnail
                  ? <img src={d.thumbnail} style={styles.thumbImg} alt={d.name} />
                  : <div style={styles.thumbEmpty} />
                }
              </div>

              {/* Nom / renommage */}
              {renamingId === d.id ? (
                <div style={styles.renameRow} onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    style={styles.renameInput}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(d.id); if (e.key === 'Escape') setRenamingId(null); }}
                  />
                  <button style={styles.renameOk} onClick={() => handleRename(d.id)}>OK</button>
                  <button style={styles.renameCancel} onClick={() => setRenamingId(null)}>✕</button>
                </div>
              ) : (
                <div style={styles.cardFooter}>
                  <span style={styles.cardName}>{d.name}</span>
                  <button style={styles.iconBtn} onClick={e => { e.stopPropagation(); setRenamingId(d.id); setRenameValue(d.name); }} title="Renommer">✏️</button>
                  <button style={styles.iconBtn} onClick={e => { e.stopPropagation(); handleDelete(d.id); }} title="Supprimer">🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


const styles: Record<string, React.CSSProperties> = {
  root: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' },
  topBar: { display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '12px 16px', gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  newBtn: { background: '#e63946', border: 'none', borderRadius: 10, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { color: '#aaa', fontSize: 16 },
  newBtnLarge: { background: '#e63946', border: 'none', borderRadius: 12, padding: '12px 28px', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' },
  grid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16, padding: 16, overflowY: 'auto', alignContent: 'start' },
  card: { background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' },
  // Hauteur fixe pour la vignette — évite le padding-trick qui fait déborder les absolute children sur le footer (bug mobile)
  thumbnail: { position: 'relative', width: '100%', height: 120, flexShrink: 0, overflow: 'hidden', background: '#f8f8f8' },
  thumbImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  thumbEmpty: { position: 'absolute', inset: 0, background: '#f0f0f0' },
  cardFooter: { display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 4, flexShrink: 0 },
  cardName: { flex: 1, fontSize: 12, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 6px', flexShrink: 0 },
  renameRow: { display: 'flex', alignItems: 'center', padding: '6px 8px', gap: 4, flexShrink: 0 },
  renameInput: { flex: 1, border: '1px solid #e8e8e8', borderRadius: 6, padding: '4px 6px', fontSize: 12 },
  renameOk: { background: '#e63946', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 8px', cursor: 'pointer' },
  renameCancel: { background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', color: '#aaa' },
};
