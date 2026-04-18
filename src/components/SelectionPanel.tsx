import { useRef, useState } from 'react';
import { DrawLayer, Stroke, AirbrushStroke, TextLayer } from '../types';
import { useDragToReorder } from '../hooks/useDragToReorder';

interface PanelItem {
  id: string;
  kind: 'stroke' | 'airbrush' | 'text';
}

type SelectSubMode = 'none' | 'rotate' | 'scale';

interface Props {
  layers: DrawLayer[];
  selection: string[];
  focusedIds: string[];
  selectSubMode: SelectSubMode;
  onFocus: (id: string) => void;
  onSetSelectSubMode: (mode: 'rotate' | 'scale') => void;
  onDeselect: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onReorderByIds: (orderedIds: string[]) => void;
}

const THUMB_W = 64;
const THUMB_H = 52;

function ItemPreview({ kind, stroke, ab, tb }: {
  kind: PanelItem['kind'];
  stroke?: Stroke;
  ab?: AirbrushStroke;
  tb?: TextLayer;
}) {
  return (
    <div style={{ width: THUMB_W, height: THUMB_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'stroke' && stroke && (
        <svg width={THUMB_W - 8} height={THUMB_H - 8} viewBox="0 0 56 44">
          <line x1="6" y1="34" x2="50" y2="10"
            stroke={stroke.color}
            strokeWidth={Math.min(stroke.width / 1.5, 7)}
            strokeLinecap="round"
            opacity={stroke.opacity}
          />
        </svg>
      )}
      {kind === 'airbrush' && ab && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `radial-gradient(circle, ${ab.color} 0%, transparent 100%)`,
        }} />
      )}
      {kind === 'text' && tb && (
        <span style={{
          fontSize: 13, fontFamily: tb.fontFamily, color: tb.color,
          maxWidth: THUMB_W - 8, overflow: 'hidden', whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}>
          {tb.text.slice(0, 6)}{tb.text.length > 6 ? '...' : ''}
        </span>
      )}
    </div>
  );
}

export function SelectionPanel({
  layers,
  selection,
  focusedIds,
  selectSubMode,
  onFocus,
  onSetSelectSubMode,
  onDeselect, onDeleteItem, onDeleteSelected, onClearSelection,
  onReorderByIds,
}: Props) {
  if (selection.length === 0) return null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [panelSelected, setPanelSelected] = useState<string[]>([]);

  const allItems: PanelItem[] = layers
    .filter(l => selection.includes(l.id))
    .map(l => ({
      id: l.id,
      kind: l.tool === 'airbrush' ? 'airbrush' : l.tool === 'text' ? 'text' : 'stroke',
    } as PanelItem))
    .reverse(); // on-top à gauche

  const handleSelect = (id: string) => {
    setPanelSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    onFocus(id); // TAP panel → niveau 2 (focusedId toggle)
  };

  const { dragState, getDragHandlers } = useDragToReorder({
    items: allItems,
    getId: item => item.id,
    selectedIds: panelSelected,
    onReorder: newItems => onReorderByIds(newItems.map(i => i.id)),
    onSelect: handleSelect,
    scrollContainerRef: scrollRef,
  });

  const isDraggingGroup = dragState.isDragging &&
    dragState.draggingId !== null &&
    panelSelected.includes(dragState.draggingId);

  const draggingItem = dragState.draggingId
    ? allItems.find(i => i.id === dragState.draggingId)
    : null;

  return (
    <div style={s.root}>
      <div ref={scrollRef} style={s.list}>
        {allItems.map((item, idx) => {
          const { id, kind } = item;
          const layer = layers.find(l => l.id === id);
          const stroke = kind === 'stroke' ? layer as Stroke : undefined;
          const ab = kind === 'airbrush' ? layer as AirbrushStroke : undefined;
          const tb = kind === 'text' ? layer as TextLayer : undefined;

          const isItemSelected = panelSelected.includes(id);
          const isItemFocused = focusedIds.includes(id);
          const isDraggingThis = dragState.draggingId === id && dragState.isDragging;
          const isDragFollower = isDraggingGroup && panelSelected.includes(id) && dragState.draggingId !== id;
          const showInsertBefore = dragState.isDragging && dragState.insertIndex === idx && !panelSelected.includes(id);
          const showInsertAfter = dragState.isDragging && dragState.insertIndex === allItems.length && idx === allItems.length - 1;

          const labelText = kind === 'stroke'
            ? (stroke?.tool === 'marker' ? 'Marqueur' : 'Stylo')
            : kind === 'airbrush' ? 'Aerogr.'
            : 'Texte';

          return (
            <div key={id} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
              {showInsertBefore && <div style={s.insertBar} />}

              <div
                {...getDragHandlers(id)}
                data-drag-id={id}
                style={{
                  ...s.itemCol,
                  // L'item principal en drag devient invisible (remplacé par le ghost)
                  // Les followers disparaissent du flux (ils apparaissent dans le ghost fixé)
                  opacity: (isDraggingThis || isDragFollower) ? 0 : 1,
                  pointerEvents: isDragFollower ? 'none' : undefined,
                }}
              >
                {/* Barre badge au-dessus de la vignette */}
                <div style={{
                  ...s.badgeBar,
                  visibility: isItemSelected && !isDraggingThis ? 'visible' : 'hidden',
                }}>
                  <button
                    style={s.badgeBtn}
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => { e.stopPropagation(); onDeleteItem(id); setPanelSelected(p => p.filter(x => x !== id)); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                  <div style={s.badgeSep} />
                  <button
                    style={s.badgeBtn}
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => { e.stopPropagation(); onDeselect(id); setPanelSelected(p => p.filter(x => x !== id)); }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                {/* Vignette */}
                <div style={{
                  ...s.thumb,
                  ...(isItemSelected && !isDraggingThis ? s.thumbSelected : {}),
                  ...(isItemFocused && !isDraggingThis ? s.thumbFocused : {}),
                }}>
                  <ItemPreview kind={kind} stroke={stroke} ab={ab} tb={tb} />
                </div>

                {/* Label — caché pendant le drag */}
                <span style={{ ...s.label, visibility: isDraggingThis ? 'hidden' : 'visible' }}>
                  {labelText}
                </span>
              </div>

              {showInsertAfter && <div style={s.insertBar} />}
            </div>
          );
        })}
      </div>

      {/* Ghost fixé sous le doigt pendant le drag */}
      {dragState.isDragging && draggingItem && (() => {
        const { id, kind } = draggingItem;
        const layer = layers.find(l => l.id === id);
        const stroke = kind === 'stroke' ? layer as Stroke : undefined;
        const ab = kind === 'airbrush' ? layer as AirbrushStroke : undefined;
        const tb = kind === 'text' ? layer as TextLayer : undefined;
        const isGroup = panelSelected.includes(id) && panelSelected.length > 1;
        const followers = panelSelected.filter(pid => pid !== id).slice(0, 3);

        return (
          <div style={{
            position: 'fixed',
            left: dragState.pointerX - THUMB_W / 2,
            top: dragState.pointerY - THUMB_H / 2 - 10,
            pointerEvents: 'none',
            zIndex: 9999,
          }}>
            {/* Followers en éventail — chacun affiche son propre preview */}
            {isGroup && followers.map((pid, i) => {
              const fItem = allItems.find(it => it.id === pid);
              if (!fItem) return null;
              const fLayer = layers.find(l => l.id === pid);
              const fStroke = fItem.kind === 'stroke' ? fLayer as Stroke : undefined;
              const fAb = fItem.kind === 'airbrush' ? fLayer as AirbrushStroke : undefined;
              const fTb = fItem.kind === 'text' ? fLayer as TextLayer : undefined;
              return (
                <div key={pid} style={{
                  ...s.thumb,
                  position: 'absolute',
                  top: (i + 1) * 4,
                  left: (i + 1) * 3,
                  zIndex: -(i + 1),
                  opacity: 0.65 - i * 0.1,
                  transform: `rotate(${(i + 1) * 2}deg)`,
                }}>
                  <ItemPreview kind={fItem.kind} stroke={fStroke} ab={fAb} tb={fTb} />
                </div>
              );
            })}
            {/* Vignette principale soulevée + rotation légère */}
            <div style={{
              ...s.thumb,
              ...s.thumbDragging,
              transform: 'scale(1.1) rotate(-3deg)',
              transformOrigin: 'center center',
            }}>
              <ItemPreview kind={kind} stroke={stroke} ab={ab} tb={tb} />
            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <div style={s.footer}>
        <span style={s.count}>
          {selection.length} tracé{selection.length > 1 ? 's' : ''} sélectionné{selection.length > 1 ? 's' : ''}
        </span>
        {focusedIds.length > 0 && (
          <>
            <button
              style={{
                ...s.footerBtn,
                ...(selectSubMode === 'rotate' ? s.footerBtnActive : {}),
              }}
              onClick={() => onSetSelectSubMode('rotate')}
              title="Rotation"
            >
              <img src="/icons/rotate.svg" width="16" height="16" alt="Rotate" style={{ opacity: selectSubMode === 'rotate' ? 1 : 0.6 }} />
            </button>
            <button
              style={{
                ...s.footerBtn,
                ...(selectSubMode === 'scale' ? s.footerBtnActive : {}),
              }}
              onClick={() => onSetSelectSubMode('scale')}
              title="Redimensionner"
            >
              <img src="/icons/scale.svg" width="16" height="16" alt="Scale" style={{ opacity: selectSubMode === 'scale' ? 1 : 0.6 }} />
            </button>
          </>
        )}
        <button style={s.footerBtn} onClick={onDeleteSelected} title="Tout supprimer">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
        <button style={s.footerBtn} onClick={onClearSelection} title="Tout desélectionner">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
    flexShrink: 0,
    maxHeight: 168,
    display: 'flex',
    flexDirection: 'column',
  },
  list: {
    display: 'flex',
    gap: 10,
    padding: '8px 14px 4px',
    overflowX: 'auto',
    flex: 1,
    scrollbarWidth: 'none',
    position: 'relative',
    alignItems: 'flex-start',
  },
  itemCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
    userSelect: 'none',
    touchAction: 'none',
    position: 'relative',
  },
  badgeBar: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    background: '#fff',
    border: '1px solid #e8e8e8',
    borderRadius: 8,
    boxShadow: '0 1px 5px rgba(0,0,0,0.10)',
    overflow: 'hidden',
    height: 28,
    width: THUMB_W,
    flexShrink: 0,
  },
  badgeBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#444',
    height: '100%',
    padding: 0,
  },
  badgeSep: {
    width: 1,
    height: 16,
    background: '#e0e0e0',
    flexShrink: 0,
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
    background: '#f4f4f4',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid transparent',
    transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s, background 0.12s',
    cursor: 'pointer',
    overflow: 'hidden',
    flexShrink: 0,
    boxSizing: 'border-box',
  },
  thumbSelected: {
    border: '2px solid #222',
    background: '#fff',
    transform: 'scale(1.06) translateY(-2px)',
    boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
  },
  thumbFocused: {
    border: '2px solid #f4a261',
    boxShadow: '0 6px 18px rgba(244,162,97,0.3)',
  },
  thumbDragging: {
    border: '2px solid #222',
    background: '#fff',
    boxShadow: '0 14px 36px rgba(0,0,0,0.28)',
  },
  label: {
    fontSize: 10,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: 500,
  },
  insertBar: {
    width: 3,
    borderRadius: 2,
    background: '#118ab2',
    marginTop: 31, // aligne avec le haut de la vignette (après barre badge 28px + gap 3px)
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 12px 6px',
    gap: 6,
    borderTop: '1px solid #f0f0f0',
  },
  count: { flex: 1, fontSize: 11, color: '#888' },
  footerBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#555',
    padding: '5px 8px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnActive: {
    background: 'linear-gradient(135deg, #118ab2 0%, #06d6a0 100%)',
    color: '#fff',
  },
};
