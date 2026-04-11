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
        <div style={styles.grid}>
          {drawings.map(d => (
            <div key={d.id} style={styles.card} onClick={() => onOpen(d)}>
              <div style={styles.thumbnail}>
                {d.thumbnail
                  ? <img src={d.thumbnail} style={styles.thumbImg} alt={d.name} />
                  : <div style={styles.thumbEmpty} />
                }
              </div>
              <div style={styles.cardFooter}>
                <span style={styles.cardName}>{d.name}</span>
                <span style={styles.cardSep}>|</span>
                <span style={styles.cardTime}>{timeAgo(d.updatedAt)}</span>
              </div>
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
  grid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: 12, overflowY: 'auto', alignContent: 'start' },
  card: { background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' },
  thumbnail: { position: 'relative', width: '100%', height: 300, flexShrink: 0, overflow: 'hidden', background: '#f8f8f8' },
  thumbImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  thumbEmpty: { position: 'absolute', inset: 0, background: '#f0f0f0' },
  cardFooter: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '8px 10px', gap: 6 },
  cardName: { fontSize: 13, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardSep: { fontSize: 12, color: '#ccc', flexShrink: 0 },
  cardTime: { fontSize: 11, color: '#999', flexShrink: 0 },
  versionBadge: { textAlign: 'center', padding: '12px 0', fontSize: 11, color: '#bbb', flexShrink: 0 },
};
