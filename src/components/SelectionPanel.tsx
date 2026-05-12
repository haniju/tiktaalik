import React, { useRef, useState } from 'react';
import { DrawLayer, Stroke, AirbrushStroke, TextLayer } from '../types';
import { useDragToReorder } from '../hooks/useDragToReorder';
import { getGroupPanelItems, canGroup, canUngroup, PanelDisplayItem } from '../utils/groupUtils';

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
  onSelectAll: () => void;
  onUnselectAll: () => void;
  onReorderByIds: (orderedIds: string[]) => void;
  onGroup: () => void;
  onUngroup: () => void;
}

const THUMB_W = 64;
const THUMB_H = 52;

type ItemKind = 'stroke' | 'airbrush' | 'text';

function layerKind(layer: DrawLayer): ItemKind {
  return layer.tool === 'airbrush' ? 'airbrush' : layer.tool === 'text' ? 'text' : 'stroke';
}

function layerLabel(layer: DrawLayer): string {
  if (layer.tool === 'marker') return 'Marqueur';
  if (layer.tool === 'pen') return 'Stylo';
  if (layer.tool === 'airbrush') return 'Aerogr.';
  return 'Texte';
}

function ItemPreview({ layer }: { layer: DrawLayer }) {
  const kind = layerKind(layer);
  return (
    <div style={{ width: THUMB_W, height: THUMB_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'stroke' && (
        <svg width={THUMB_W - 8} height={THUMB_H - 8} viewBox="0 0 56 44">
          <line x1="6" y1="34" x2="50" y2="10"
            stroke={(layer as Stroke).color}
            strokeWidth={Math.min((layer as Stroke).width / 1.5, 7)}
            strokeLinecap="round"
            opacity={(layer as Stroke).opacity}
          />
        </svg>
      )}
      {kind === 'airbrush' && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `radial-gradient(circle, ${(layer as AirbrushStroke).color} 0%, transparent 100%)`,
        }} />
      )}
      {kind === 'text' && (
        <span style={{
          fontSize: 13, fontFamily: (layer as TextLayer).fontFamily, color: (layer as TextLayer).color,
          maxWidth: THUMB_W - 8, overflow: 'hidden', whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}>
          {(layer as TextLayer).text.slice(0, 6)}{(layer as TextLayer).text.length > 6 ? '...' : ''}
        </span>
      )}
    </div>
  );
}

/** Bordures empilées derrière la vignette pour les groupes */
function StackedBorders() {
  return (
    <>
      <div style={{
        position: 'absolute', top: 3, left: 2,
        width: THUMB_W, height: THUMB_H,
        borderRadius: 12, border: '2px solid #d8d8d8',
        background: '#eee', boxSizing: 'border-box',
        zIndex: -1,
      }} />
      <div style={{
        position: 'absolute', top: 6, left: 4,
        width: THUMB_W, height: THUMB_H,
        borderRadius: 12, border: '2px solid #ccc',
        background: '#e0e0e0', boxSizing: 'border-box',
        zIndex: -2,
      }} />
    </>
  );
}

// Interface interne pour le drag-to-reorder (besoin d'un id unique par item)
interface FlatPanelItem {
  id: string; // pour les singles = layer id, pour les groupes = groupId
  displayItem: PanelDisplayItem;
}

export function SelectionPanel({
  layers,
  selection,
  focusedIds,
  selectSubMode,
  onFocus,
  onSetSelectSubMode,
  onDeselect, onDeleteItem, onDeleteSelected,
  onSelectAll, onUnselectAll,
  onReorderByIds,
  onGroup, onUngroup,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [panelSelected, setPanelSelected] = useState<string[]>([]);

  const displayItems = getGroupPanelItems(layers, selection);

  // Adapter pour le drag-to-reorder
  const flatItems: FlatPanelItem[] = displayItems.map(di => ({
    id: di.type === 'single' ? di.id : di.groupId,
    displayItem: di,
  }));

  const handleSelect = (id: string) => {
    setPanelSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    // Trouver le premier memberId pour le focus
    const di = displayItems.find(d =>
      (d.type === 'single' && d.id === id) || (d.type === 'group' && d.groupId === id)
    );
    if (di) {
      const focusId = di.type === 'single' ? di.id : di.memberIds[0];
      onFocus(focusId);
    }
  };

  const { dragState, getDragHandlers } = useDragToReorder({
    items: flatItems,
    getId: item => item.id,
    selectedIds: panelSelected,
    onReorder: newItems => {
      // Expand groupes → memberIds (en ordre interne préservé)
      const orderedIds: string[] = [];
      for (const fi of newItems) {
        if (fi.displayItem.type === 'single') {
          orderedIds.push(fi.displayItem.id);
        } else {
          orderedIds.push(...fi.displayItem.memberIds);
        }
      }
      onReorderByIds(orderedIds);
    },
    onSelect: handleSelect,
    scrollContainerRef: scrollRef,
  });

  if (selection.length === 0) return null;

  const isDraggingGroup = dragState.isDragging &&
    dragState.draggingId !== null &&
    panelSelected.includes(dragState.draggingId);

  const draggingFlatItem = dragState.draggingId
    ? flatItems.find(i => i.id === dragState.draggingId)
    : null;

  const showGroupBtn = canGroup(layers, focusedIds);
  const showUngroupBtn = canUngroup(layers, focusedIds);

  const allFocused = focusedIds.length > 0 && focusedIds.length >= selection.length;

  return (
    <div style={st.root}>
      {/* Toolbar */}
      <div style={st.toolbar}>
        {/* Gauche : delete */}
        <button style={st.toolbarBtn} onClick={onDeleteSelected} title="Tout supprimer">
          <img src="/icons/delete.svg" width="15" height="15" alt="Supprimer" style={{ opacity: 0.6 }} />
        </button>

        {/* Centre : group/ungroup + rotate/scale (visibles seulement quand focusedIds > 0) */}
        <div style={{ flex: 1 }} />

        {showGroupBtn && (
          <button style={st.toolbarBtn} onClick={onGroup} title="Grouper">
            <img src="/icons/group.svg" width="16" height="16" alt="Group" style={{ opacity: 0.6 }} />
          </button>
        )}
        {showUngroupBtn && (
          <button style={st.toolbarBtn} onClick={onUngroup} title="Dégrouper">
            <img src="/icons/ungroup.svg" width="16" height="16" alt="Ungroup" style={{ opacity: 0.6 }} />
          </button>
        )}

        {focusedIds.length > 0 && (
          <>
            {(showGroupBtn || showUngroupBtn) && <div style={st.toolbarSep} />}
            <button
              style={{
                ...st.toolbarBtn,
                ...(selectSubMode === 'rotate' ? st.toolbarBtnActive : {}),
              }}
              onClick={() => onSetSelectSubMode('rotate')}
              title="Rotation"
            >
              <img src="/icons/rotate.svg" width="16" height="16" alt="Rotate" style={{ opacity: selectSubMode === 'rotate' ? 1 : 0.6 }} />
            </button>
            <button
              style={{
                ...st.toolbarBtn,
                ...(selectSubMode === 'scale' ? st.toolbarBtnActive : {}),
              }}
              onClick={() => onSetSelectSubMode('scale')}
              title="Redimensionner"
            >
              <img src="/icons/scale.svg" width="16" height="16" alt="Scale" style={{ opacity: selectSubMode === 'scale' ? 1 : 0.6 }} />
            </button>
          </>
        )}

        {(focusedIds.length > 0 || showGroupBtn || showUngroupBtn) && <div style={st.toolbarSep} />}

        {/* Select-all / Unselect-all */}
        {allFocused ? (
          <button style={st.toolbarBtn} onClick={onUnselectAll} title="Tout défocaliser">
            <img src="/icons/unselect-all.svg" width="18" height="18" alt="Unselect all" style={{ opacity: 0.6 }} />
          </button>
        ) : (
          <button style={st.toolbarBtn} onClick={onSelectAll} title="Tout focaliser">
            <img src="/icons/select-all.svg" width="18" height="18" alt="Select all" style={{ opacity: 0.6 }} />
          </button>
        )}

        {/* Droite : compteur */}
        <span style={st.count}>
          {selection.length}
        </span>
      </div>

      {/* Liste de vignettes */}
      <div ref={scrollRef} style={st.list}>
        {flatItems.map((fi, idx) => {
          const { id, displayItem: di } = fi;
          const isGroup = di.type === 'group';
          const previewLayer = isGroup ? di.topLayer : di.layer;
          const label = isGroup ? 'Groupe' : layerLabel(di.layer);

          // L'item du panel est "focused" si :
          // - single: son id est dans focusedIds
          // - group: tous ses memberIds sont dans focusedIds
          const isItemFocused = isGroup
            ? di.memberIds.every(mid => focusedIds.includes(mid))
            : focusedIds.includes(di.id);

          const isItemSelected = panelSelected.includes(id);
          const isDraggingThis = dragState.draggingId === id && dragState.isDragging;
          const isDragFollower = isDraggingGroup && panelSelected.includes(id) && dragState.draggingId !== id;
          const showInsertBefore = dragState.isDragging && dragState.insertIndex === idx && !panelSelected.includes(id);
          const showInsertAfter = dragState.isDragging && dragState.insertIndex === flatItems.length && idx === flatItems.length - 1;

          // Pour le delete/deselect, utiliser le premier memberId du groupe
          const actionId = isGroup ? di.memberIds[0] : di.id;

          return (
            <div key={id} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
              {showInsertBefore && <div style={st.insertBar} />}

              <div
                {...getDragHandlers(id)}
                data-drag-id={id}
                style={{
                  ...st.itemCol,
                  opacity: (isDraggingThis || isDragFollower) ? 0 : 1,
                  pointerEvents: isDragFollower ? 'none' : undefined,
                }}
              >
                {/* Label */}
                <span style={{ ...st.label, visibility: isDraggingThis ? 'hidden' : 'visible' }}>
                  {label}
                </span>

                {/* Vignette avec bordures empilées pour les groupes */}
                <div style={{ position: 'relative' }}>
                  {isGroup && !isDraggingThis && <StackedBorders />}
                  <div style={{
                    ...st.thumb,
                    ...(isItemSelected && !isDraggingThis ? st.thumbSelected : {}),
                    ...(isItemFocused && !isDraggingThis ? st.thumbFocused : {}),
                    position: 'relative',
                    zIndex: 0,
                  }}>
                    <ItemPreview layer={previewLayer} />
                  </div>
                </div>

                {/* Badge bar */}
                <div style={{
                  ...st.badgeBar,
                  visibility: isItemSelected && !isDraggingThis ? 'visible' : 'hidden',
                }}>
                  <button
                    style={st.badgeBtn}
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => { e.stopPropagation(); onDeleteItem(actionId); setPanelSelected(p => p.filter(x => x !== id)); }}
                  >
                    <img src="/icons/delete.svg" width="13" height="13" alt="Supprimer" />
                  </button>
                  <div style={st.badgeSep} />
                  <button
                    style={st.badgeBtn}
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => { e.stopPropagation(); onDeselect(actionId); setPanelSelected(p => p.filter(x => x !== id)); }}
                  >
                    <img src="/icons/close.svg" width="11" height="11" alt="Fermer" />
                  </button>
                </div>
              </div>

              {showInsertAfter && <div style={st.insertBar} />}
            </div>
          );
        })}
      </div>

      {/* Ghost fixé sous le doigt pendant le drag */}
      {dragState.isDragging && draggingFlatItem && (() => {
        const di = draggingFlatItem.displayItem;
        const previewLayer = di.type === 'group' ? di.topLayer : di.layer;
        const isMultiDrag = panelSelected.includes(draggingFlatItem.id) && panelSelected.length > 1;
        const followers = panelSelected.filter(pid => pid !== draggingFlatItem.id).slice(0, 3);

        return (
          <div style={{
            position: 'fixed',
            left: dragState.pointerX - THUMB_W / 2,
            top: dragState.pointerY - THUMB_H / 2 - 10,
            pointerEvents: 'none',
            zIndex: 9999,
          }}>
            {isMultiDrag && followers.map((pid, i) => {
              const fFlatItem = flatItems.find(it => it.id === pid);
              if (!fFlatItem) return null;
              const fLayer = fFlatItem.displayItem.type === 'group'
                ? fFlatItem.displayItem.topLayer
                : fFlatItem.displayItem.layer;
              return (
                <div key={pid} style={{
                  ...st.thumb,
                  position: 'absolute',
                  top: (i + 1) * 4,
                  left: (i + 1) * 3,
                  zIndex: -(i + 1),
                  opacity: 0.65 - i * 0.1,
                  transform: `rotate(${(i + 1) * 2}deg)`,
                }}>
                  <ItemPreview layer={fLayer} />
                </div>
              );
            })}
            <div style={{
              ...st.thumb,
              ...st.thumbDragging,
              transform: 'scale(1.1) rotate(-3deg)',
              transformOrigin: 'center center',
            }}>
              <ItemPreview layer={previewLayer} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  root: {
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
    flexShrink: 0,
    maxHeight: 184,
    display: 'flex',
    flexDirection: 'column',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 12px',
    gap: 6,
    borderBottom: '1px solid #f0f0f0',
    flexShrink: 0,
  },
  count: { fontSize: 11, color: '#888', minWidth: 20, textAlign: 'right' },
  toolbarBtn: {
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
  toolbarSep: {
    width: 1,
    height: 18,
    background: '#e0e0e0',
    flexShrink: 0,
  },
  toolbarBtnActive: {
    background: 'linear-gradient(135deg, #118ab2 0%, #06d6a0 100%)',
    color: '#fff',
  },
  list: {
    display: 'flex',
    gap: 10,
    padding: '6px 14px 6px',
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
  label: {
    fontSize: 10,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: 500,
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
  insertBar: {
    width: 3,
    borderRadius: 2,
    background: '#118ab2',
    marginTop: 16,
    flexShrink: 0,
    alignSelf: 'stretch',
  },
};
