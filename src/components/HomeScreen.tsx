import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Drawing } from '../types';
import { useDrawingStorage } from '../hooks/useDrawingStorage';
import { useDrawingOrder } from '../hooks/useDrawingOrder';
import { useDragToReorder } from '../hooks/useDragToReorder';
import { AboutModal } from './AboutModal';
import { getInstallPrompt, clearInstallPrompt, subscribeInstallPrompt } from '../utils/pwaInstall';


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
const BUILD_TIME = __BUILD_TIME__;
const IS_BETA = __IS_BETA__;
const GHOST_W = 120;
const GHOST_H = 170; // ratio A4 approx

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

// Icônes SVG inline
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const storage = useDrawingStorage();
  const drawingOrder = useDrawingOrder();
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Initialisé depuis le store global : l'événement a pu être capturé avant ce mount
  const [showInstall, setShowInstall] = useState(() => getInstallPrompt() !== null);
  const galerieRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storage.getAll().then(all => {
      setDrawings(drawingOrder.applyOrder(all));
      setLoading(false);
    });
  }, []);


  // PWA install — abonnement au store global (l'événement peut avoir été capturé
  // avant ce mount, ou être émis pendant qu'on est sur cet écran)
  useEffect(() => subscribeInstallPrompt(e => setShowInstall(e !== null)), []);

  const handleInstall = async () => {
    const p = getInstallPrompt();
    if (!p) { setShowInstall(false); return; }
    try {
      await p.prompt();
      await p.userChoice;
      clearInstallPrompt(); // consomme l'événement → showInstall passe à false via le store
    } catch {
      clearInstallPrompt();
      alert('Pour installer : ouvre le menu du navigateur (⋮) puis "Ajouter à l\'écran d\'accueil"');
    }
  };

  const handleNew = async () => {
    const d = newDrawing();
    await storage.save(d);
    navigate(`/sketch/${d.id}`);
  };

  // Drag-to-reorder
  const handleReorder = useCallback((newDrawings: Drawing[]) => {
    setDrawings(newDrawings);
    drawingOrder.saveOrder(newDrawings.map(d => d.id));
  }, [drawingOrder]);

  const handleSelect = useCallback((id: string) => {
    if (selectedIds.length === 0) {
      navigate(`/sketch/${id}`);
    } else if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  }, [selectedIds, navigate]);

  const handleLongPressRelease = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const { dragState, getDragHandlers } = useDragToReorder({
    items: drawings,
    getId: d => d.id,
    selectedIds,
    onReorder: handleReorder,
    onSelect: handleSelect,
    onLongPressRelease: handleLongPressRelease,
    scrollContainerRef: galerieRef,
    layout: 'grid',
  });

  // Tap fond galerie → désélectionner
  const handleGalerieClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && selectedIds.length > 0) {
      setSelectedIds([]);
    }
  }, [selectedIds]);

  // Supprimer un dessin
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await storage.remove(deleteTarget);
    drawingOrder.removeFromOrder(deleteTarget);
    setDrawings(prev => prev.filter(d => d.id !== deleteTarget));
    setSelectedIds(prev => prev.filter(x => x !== deleteTarget));
    setDeleteTarget(null);
  }, [deleteTarget, storage, drawingOrder]);

  // Renommer un dessin
  const handleConfirmRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return;
    await storage.rename(renameTarget, renameValue.trim());
    setDrawings(prev => prev.map(d =>
      d.id === renameTarget ? { ...d, name: renameValue.trim() } : d
    ));
    setRenameTarget(null);
  }, [renameTarget, renameValue, storage]);

  const openRenameDialog = useCallback((id: string) => {
    const d = drawings.find(dr => dr.id === id);
    setRenameValue(d?.name ?? '');
    setRenameTarget(id);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 50);
  }, [drawings]);

  // Ghost drag
  const isDragging = dragState.isDragging;
  const draggingDrawing = isDragging && dragState.draggingId
    ? drawings.find(d => d.id === dragState.draggingId)
    : null;
  const isDraggingGroup = isDragging && dragState.draggingId !== null && selectedIds.includes(dragState.draggingId);

  return (
    <div style={styles.home}>
      {/* Topbar */}
      <div style={styles.topBar}>
        <span style={styles.title}>Mes dessins{IS_BETA && <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: '#e63946', borderRadius: 6, padding: '2px 6px', marginLeft: 6, verticalAlign: 'middle' }}>BETA</span>}</span>
        {showInstall && (
          <button style={styles.installBtn} onClick={handleInstall}>Installer</button>
        )}
        <button style={styles.newBtn} onClick={handleNew}>+ Nouveau</button>
        <div style={{ position: 'relative' }}>
          <button style={{ ...styles.burgerBtn, ...(menuOpen ? styles.burgerBtnActive : {}) }} onClick={() => setMenuOpen(p => !p)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          {menuOpen && (
            <>
            <div style={styles.dropdownOverlay} onClick={() => setMenuOpen(false)} onTouchEnd={e => { e.preventDefault(); setMenuOpen(false); }} />
            <div style={styles.dropdown}>
              <button style={styles.dropdownItem} onClick={() => { setMenuOpen(false); setShowAbout(true); }}>À propos</button>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Galerie */}
      {loading ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Chargement…</p>
        </div>
      ) : drawings.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Aucun dessin</p>
          <button style={styles.newBtnLarge} onClick={handleNew}>Créer un dessin</button>
        </div>
      ) : (
        <div ref={galerieRef} style={styles.galerie} onClick={handleGalerieClick}>
          {drawings.map((d, idx) => {
            const isSelected = selectedIds.includes(d.id);
            const isDraggingThis = isDragging && dragState.draggingId === d.id;
            const isDragFollower = isDraggingGroup && selectedIds.includes(d.id) && dragState.draggingId !== d.id;
            const showInsertBefore = isDragging && dragState.insertIndex === idx;
            const showInsertAfter = isDragging && dragState.insertIndex === drawings.length && idx === drawings.length - 1;

            return (
              <div key={d.id} style={{ display: 'contents' }}>
                {showInsertBefore && <div style={styles.insertBar} />}

                <div
                  {...getDragHandlers(d.id)}
                  onContextMenu={e => e.preventDefault()}
                  style={{
                    ...styles.vignette,
                    ...(isSelected && !isDraggingThis ? styles.vignetteSelected : {}),
                    opacity: (isDraggingThis || isDragFollower) ? 0.2 : 1,
                    touchAction: 'pan-y',
                    WebkitTouchCallout: 'none',
                    userSelect: 'none',
                  } as React.CSSProperties}
                >
                  {/* Badge bar — visible quand sélectionné et pas en drag */}
                  {isSelected && !isDraggingThis && !isDragging && (
                    <div style={styles.badgeBar}>
                      <button
                        style={styles.badgeBtn}
                        onPointerDown={e => e.stopPropagation()}
                        onPointerUp={e => { e.stopPropagation(); setDeleteTarget(d.id); }}
                      >
                        <TrashIcon />
                      </button>
                      <div style={styles.badgeSep} />
                      <button
                        style={styles.badgeBtn}
                        onPointerDown={e => e.stopPropagation()}
                        onPointerUp={e => { e.stopPropagation(); openRenameDialog(d.id); }}
                      >
                        <EditIcon />
                      </button>
                    </div>
                  )}

                  <div style={styles.vignetteThumb}>
                    {d.thumbnail
                      ? <img src={d.thumbnail} style={styles.vignetteThumbImg} alt={d.name} />
                      : <div style={styles.vignetteThumbEmpty} />
                    }
                  </div>
                  <div style={styles.vignetteFooter}>
                    <span style={styles.vignetteName}>{d.name}</span>
                    <span style={styles.vignetteSep}>|</span>
                    <span style={styles.vignetteTime}>{timeAgo(d.updatedAt)}</span>
                  </div>
                </div>

                {showInsertAfter && <div style={styles.insertBar} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Ghost flottant pendant le drag */}
      {isDragging && draggingDrawing && (
        <div style={{
          position: 'fixed',
          left: dragState.pointerX - GHOST_W / 2,
          top: dragState.pointerY - GHOST_H / 2 - 10,
          pointerEvents: 'none',
          zIndex: 9999,
        }}>
          {/* Followers en éventail */}
          {isDraggingGroup && selectedIds
            .filter(id => id !== dragState.draggingId)
            .slice(0, 3)
            .map((id, i) => {
              const fd = drawings.find(dr => dr.id === id);
              if (!fd) return null;
              return (
                <div key={id} style={{
                  ...styles.ghostThumb,
                  position: 'absolute',
                  top: (i + 1) * 6,
                  left: (i + 1) * 4,
                  zIndex: -(i + 1),
                  opacity: 0.6 - i * 0.15,
                  transform: `rotate(${(i + 1) * 2.5}deg)`,
                }}>
                  {fd.thumbnail && <img src={fd.thumbnail} style={styles.ghostImg} alt="" />}
                </div>
              );
            })}
          {/* Vignette principale */}
          <div style={{
            ...styles.ghostThumb,
            transform: 'scale(1.08) rotate(-3deg)',
            transformOrigin: 'center center',
            boxShadow: '0 14px 36px rgba(0,0,0,0.28)',
          }}>
            {draggingDrawing.thumbnail && <img src={draggingDrawing.thumbnail} style={styles.ghostImg} alt="" />}
          </div>
        </div>
      )}

      {/* Popup renommer */}
      {renameTarget !== null && (
        <div style={styles.overlay} onClick={() => setRenameTarget(null)}>
          <div style={styles.dialog} onClick={e => e.stopPropagation()}>
            <div style={styles.dialogTitle}>Renommer</div>
            <input
              ref={renameInputRef}
              style={styles.dialogInput}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(); }}
            />
            <div style={styles.dialogActions}>
              <button style={styles.dialogBtnCancel} onClick={() => setRenameTarget(null)}>Annuler</button>
              <button style={styles.dialogBtnConfirm} onClick={handleConfirmRename}>Renommer</button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog supprimer */}
      {deleteTarget !== null && (
        <div style={styles.overlay} onClick={() => setDeleteTarget(null)}>
          <div style={styles.dialog} onClick={e => e.stopPropagation()}>
            <div style={styles.dialogTitle}>Supprimer ce dessin ?</div>
            <p style={styles.dialogText}>
              « {drawings.find(d => d.id === deleteTarget)?.name ?? ''} » sera supprimé définitivement.
            </p>
            <div style={styles.dialogActions}>
              <button style={styles.dialogBtnCancel} onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button style={styles.dialogBtnDelete} onClick={handleConfirmDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.versionBadge} onClick={() => setShowAbout(true)}>v{APP_VERSION}{IS_BETA ? ' BETA' : ''} — MAJ {BUILD_TIME}</div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}


const styles: Record<string, React.CSSProperties> = {
  home: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' },
  topBar: { display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '12px 16px', gap: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: 700, color: '#1a1a1a' },
  newBtn: { background: '#e63946', border: 'none', borderRadius: 10, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  installBtn: { background: '#118ab2', border: 'none', borderRadius: 10, padding: '8px 16px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { color: '#aaa', fontSize: 16 },
  newBtnLarge: { background: '#e63946', border: 'none', borderRadius: 12, padding: '12px 28px', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' },
  galerie: { flex: 1, display: 'flex', flexWrap: 'wrap', gap: 12, padding: 12, overflowY: 'scroll', alignContent: 'start' },
  vignette: {
    width: 'calc(50% - 6px)', height: 'max-content', background: '#fff', borderRadius: 12, overflow: 'hidden',
    cursor: 'pointer', border: '2px solid transparent', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', userSelect: 'none', position: 'relative',
    transition: 'border-color 0.15s, box-shadow 0.15s, opacity 0.15s',
  },
  vignetteSelected: {
    border: '2px solid #118ab2',
    boxShadow: '0 4px 16px rgba(17,138,178,0.2)',
  },
  vignetteThumb: { position: 'relative', width: '100%', height: '28vh', flexShrink: 0, overflow: 'hidden', background: '#f8f8f8' },
  vignetteThumbImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  vignetteThumbEmpty: { position: 'absolute', inset: 0, background: '#f0f0f0' },
  vignetteFooter: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '8px 10px', gap: 6 },
  vignetteName: { fontSize: 13, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  vignetteSep: { fontSize: 12, color: '#ccc', flexShrink: 0 },
  vignetteTime: { fontSize: 11, color: '#999', flexShrink: 0 },

  // Badge bar (supprimer / renommer) — au-dessus de la vignette
  badgeBar: {
    display: 'flex', flexDirection: 'row', alignItems: 'center',
    background: '#fff', borderBottom: '1px solid #e8e8e8',
    height: 36, flexShrink: 0,
  },
  badgeBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer', color: '#444',
    height: '100%', padding: 0,
  },
  badgeSep: { width: 1, height: 18, background: '#e0e0e0', flexShrink: 0 },

  // Insert indicator
  insertBar: {
    width: 'calc(50% - 6px)', height: 3, borderRadius: 2,
    background: '#118ab2', flexShrink: 0,
  },

  // Ghost
  ghostThumb: {
    width: GHOST_W, height: GHOST_H, borderRadius: 10, overflow: 'hidden',
    background: '#fff', border: '2px solid #118ab2',
  },
  ghostImg: { width: '100%', height: '100%', objectFit: 'cover' },

  // Dialogs
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000,
  },
  dialog: {
    background: '#fff', borderRadius: 16, padding: '24px 20px 16px',
    width: 280, maxWidth: '85vw', boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
  },
  dialogTitle: { fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 },
  dialogText: { fontSize: 14, color: '#555', margin: '0 0 16px', lineHeight: 1.4 },
  dialogInput: {
    width: '100%', fontSize: 15, padding: '10px 12px', borderRadius: 10,
    border: '1px solid #ddd', outline: 'none', marginBottom: 16,
    boxSizing: 'border-box',
  },
  dialogActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  dialogBtnCancel: {
    background: '#f0f0f0', border: 'none', borderRadius: 10,
    padding: '8px 16px', fontSize: 14, fontWeight: 600, color: '#555', cursor: 'pointer',
  },
  dialogBtnConfirm: {
    background: '#118ab2', border: 'none', borderRadius: 10,
    padding: '8px 16px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
  },
  dialogBtnDelete: {
    background: '#e63946', border: 'none', borderRadius: 10,
    padding: '8px 16px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
  },

  // Burger menu
  burgerBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '8px 10px', borderRadius: 8, color: '#555',
  },
  burgerBtnActive: { background: '#f0f0f0' },
  dropdownOverlay: { position: 'fixed', inset: 0, zIndex: 199 },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 4px)', right: 0,
    background: '#fff', borderRadius: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
    minWidth: 180, overflow: 'hidden', zIndex: 200,
  },
  dropdownItem: {
    display: 'block', width: '100%', background: 'none', border: 'none',
    padding: '12px 16px', fontSize: 15, color: '#1a1a1a',
    textAlign: 'left', cursor: 'pointer',
  },

  versionBadge: { textAlign: 'center', padding: '12px 0', fontSize: 11, color: '#bbb', flexShrink: 0, cursor: 'pointer' },
};
