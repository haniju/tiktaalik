import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

interface Props {
  drawingName: string;
  canUndo: boolean;
  canRedo: boolean;
  debug: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportSvg: () => void;
  onRename: () => void;
  onDelete: () => void;
  onToggleDebug: () => void;
}

export function Topbar({ drawingName, canUndo, canRedo, debug, onBack, onUndo, onRedo, onExportSvg, onRename, onDelete, onToggleDebug }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div style={styles.root}>
      <button style={styles.btn} onClick={onBack}>
        <Icon name="back" size={22} />
      </button>

      <span style={styles.title}>{drawingName}</span>

      <div style={styles.spacer} />

      <button style={{ ...styles.btn, opacity: canUndo ? 1 : 0.3 }} onClick={onUndo} disabled={!canUndo}>
        <Icon name="undo" size={22} />
      </button>
      <button style={{ ...styles.btn, opacity: canRedo ? 1 : 0.3 }} onClick={onRedo} disabled={!canRedo}>
        <Icon name="redo" size={22} />
      </button>

      <div ref={menuRef} style={{ position: 'relative' }}>
        <button style={{ ...styles.btn, ...(menuOpen ? styles.btnActive : {}) }} onClick={() => setMenuOpen(p => !p)}>
          <Icon name="burger" size={22} />
        </button>
        {menuOpen && (
          <div style={styles.dropdown}>
            <button style={styles.dropdownItem} onClick={() => { setMenuOpen(false); onExportSvg(); }}>Exporter en SVG</button>
            <button style={styles.dropdownItem} onClick={() => { setMenuOpen(false); onRename(); }}>Renommer</button>
            <button style={styles.dropdownItem} onClick={() => { onToggleDebug(); }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                Debug
                <span style={{
                  display: 'inline-block', width: 36, height: 20, borderRadius: 10,
                  background: debug ? '#118ab2' : '#ccc', position: 'relative', transition: 'background 0.2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: debug ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </span>
              </span>
            </button>
            <button style={{ ...styles.dropdownItem, color: '#e63946' }} onClick={() => { setMenuOpen(false); onDelete(); }}>Supprimer</button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', alignItems: 'center', height: 48, background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 4px', flexShrink: 0, gap: 2 },
  title: { fontSize: 14, color: '#555', fontWeight: 500, marginLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 },
  spacer: { flex: 1 },
  btn: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 10px', borderRadius: 8 },
  btnActive: { background: '#f0f0f0' },
  dropdown: { position: 'absolute', top: 'calc(100% + 4px)', right: 4, background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.13)', minWidth: 200, overflow: 'hidden', zIndex: 200 },
  dropdownItem: { display: 'block', width: '100%', background: 'none', border: 'none', padding: '12px 16px', fontSize: 15, color: '#1a1a1a', textAlign: 'left', cursor: 'pointer' },
};
