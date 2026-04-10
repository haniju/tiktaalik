import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Drawing } from '../types';
import { useDrawingStorage } from '../hooks/useDrawingStorage';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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

const APP_VERSION = __APP_VERSION__;

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'à l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

export function GalleryScreen({ onOpen, onNew }: Props) {
  const storage = useDrawingStorage();
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => { setDrawings(storage.getAll()); }, []);

  // Capturer l'événement beforeinstallprompt pour le bouton install PWA
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    const p = deferredPrompt.current;
    if (!p) { setShowInstall(false); return; }
    try {
      await p.prompt();
      const { outcome } = await p.userChoice;
      deferredPrompt.current = null;
      if (outcome === 'accepted') setShowInstall(false);
      // Si dismissed, un nouveau beforeinstallprompt sera émis par le navigateur
    } catch {
      // Fallback vieux Chrome : ouvrir le menu "Ajouter à l'écran d'accueil"
      deferredPrompt.current = null;
      setShowInstall(false);
      alert('Pour installer : ouvre le menu du navigateur (⋮) puis "Ajouter à l\'écran d\'accueil"');
    }
  };

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
        {showInstall && (
          <button style={styles.installBtn} onClick={handleInstall}>Installer</button>
        )}
        <button style={styles.newBtn} onClick={handleNew}>+ Nouveau</button>
      </div>

      {drawings.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Aucun dessin</p>
          <button style={styles.newBtnLarge} onClick={handleNew}>Créer un dessin</button>
        </div>
      ) : (
        <div style={styles.list}>
          {drawings.map(d => (
            <div key={d.id} style={styles.listItem} onClick={() => onOpen(d)}>
              {/* Vignette */}
              <div style={styles.thumb}>
                {d.thumbnail
                  ? <img src={d.thumbnail} style={styles.thumbImg} alt={d.name} />
                  : <div style={styles.thumbEmpty} />
                }
              </div>

              {/* Infos */}
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
                <div style={styles.itemInfo}>
                  <span style={styles.itemName}>{d.name}</span>
                  <span style={styles.itemTime}>{timeAgo(d.updatedAt)}</span>
                </div>
              )}

              {/* Actions */}
              {renamingId !== d.id && (
                <div style={styles.itemActions}>
                  <button style={styles.iconBtn} onClick={e => { e.stopPropagation(); setRenamingId(d.id); setRenameValue(d.name); }} title="Renommer">✏️</button>
                  <button style={styles.iconBtn} onClick={e => { e.stopPropagation(); handleDelete(d.id); }} title="Supprimer">🗑️</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={styles.versionBadge}>v{APP_VERSION}</div>
    </div>
  );
}


const styles: Record<string, React.CSSProperties> = {
  root: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' },
  topBar: { display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '12px 16px', gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  newBtn: { background: '#e63946', border: 'none', borderRadius: 10, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  installBtn: { background: '#118ab2', border: 'none', borderRadius: 10, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { color: '#aaa', fontSize: 16 },
  newBtnLarge: { background: '#e63946', border: 'none', borderRadius: 12, padding: '12px 28px', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' },
  list: { flex: 1, overflowY: 'auto', padding: '8px 0' },
  listItem: { display: 'flex', alignItems: 'center', height: 64, background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 16px', gap: 12, cursor: 'pointer' },
  thumb: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative', background: '#f8f8f8' },
  thumbImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  thumbEmpty: { position: 'absolute', inset: 0, background: '#f0f0f0' },
  itemInfo: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 2 },
  itemName: { fontSize: 14, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemTime: { fontSize: 11, color: '#999' },
  itemActions: { display: 'flex', gap: 4, flexShrink: 0 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 6px', flexShrink: 0 },
  renameRow: { flex: 1, display: 'flex', alignItems: 'center', gap: 4 },
  renameInput: { flex: 1, border: '1px solid #e8e8e8', borderRadius: 6, padding: '4px 6px', fontSize: 12 },
  renameOk: { background: '#e63946', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 8px', cursor: 'pointer' },
  renameCancel: { background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', color: '#aaa' },
  versionBadge: { textAlign: 'center', padding: '12px 0', fontSize: 11, color: '#bbb', flexShrink: 0 },
};
