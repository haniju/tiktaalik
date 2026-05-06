import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { Drawing, DrawLayer, DrawingTool, TextBox, TextLayer, CanvasMode } from '../types';
import { useToolState } from '../hooks/useToolState';
import { useDrawingStorage } from '../hooks/useDrawingStorage';
import { useAutosave } from '../hooks/useAutosave';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useStageViewport, clampStagePos } from '../hooks/useStageViewport';
import { useCanvasGestures } from '../hooks/useCanvasGestures';
import { exportSvg } from '../utils/export';
import {
  TextBoxSelectionState,
  makeTextLayer,
  migrateLayers,
} from '../utils/textboxUtils';
import { Topbar } from './Topbar';
import { Drawingbar } from './Drawingbar';
import { ContextToolbar } from './ContextToolbar';
import { SelectionPanel } from './SelectionPanel';
import { ActionFABs } from './ActionFABs';
import { DrawingLayer } from './DrawingLayer';
import { EditingTextarea } from './EditingTextarea';
import { ButtonMappingModal } from './ButtonMappingModal';
import { useButtonMapping } from '../hooks/useButtonMapping';


const DEBUG_DEFAULT = false;

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

interface Props {
  drawing: Drawing;
  onBack: () => void;
}



export function SketchScreen({ drawing, onBack }: Props) {
  const storage = useDrawingStorage();

  const {
    state: toolState, contextPanel, setContextPanel,
    selectDrawingTool, selectTextTool, selectEraser, selectBackground,
    setCanvasMode, enterPan, exitPan, togglePan, collapsePanel,
    setToolColor, setToolWidth, setToolOpacity, setToolSmoothing, setAirbrushEdgeOpacity,
    activeColor, activeWidth,
    // compat (non utilisé directement dans ce composant)
  } = useToolState();

  const [debug, setDebug] = useState(DEBUG_DEFAULT);

  // ─── Debug : tracking des pointers actifs ──────────────────────────────────
  const [activePointers, setActivePointers] = useState<Map<number, { x: number; y: number; target: string }>>(new Map());
  useEffect(() => {
    if (!debug) { setActivePointers(new Map()); return; }
    const getTarget = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest?.('[data-fabs]')) return 'FAB';
      if (el.closest?.('.konvajs-content')) return 'canvas';
      return el.tagName?.toLowerCase() ?? '?';
    };
    const down = (e: PointerEvent) => {
      setActivePointers(prev => new Map(prev).set(e.pointerId, { x: Math.round(e.clientX), y: Math.round(e.clientY), target: getTarget(e) }));
    };
    const move = (e: PointerEvent) => {
      setActivePointers(prev => {
        if (!prev.has(e.pointerId)) return prev;
        const next = new Map(prev);
        next.set(e.pointerId, { x: Math.round(e.clientX), y: Math.round(e.clientY), target: getTarget(e) });
        return next;
      });
    };
    const up = (e: PointerEvent) => {
      setActivePointers(prev => { const next = new Map(prev); next.delete(e.pointerId); return next; });
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
    };
  }, [debug]);

  // ─── Debug : offset bas pour rester au-dessus du clavier virtuel ───────────
  const [debugBottomOffset, setDebugBottomOffset] = useState(0);
  useEffect(() => {
    if (!debug) { setDebugBottomOffset(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setDebugBottomOffset(window.innerHeight - vv.height - vv.offsetTop);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [debug]);

  const [pinchZoom, setPinchZoom] = useState(false);
  const pinchZoomEnabledRef = useRef(pinchZoom);
  pinchZoomEnabledRef.current = pinchZoom;
  const [canvasBackground, setCanvasBackground] = useState(drawing.background ?? '#ffffff');
  const [layers, setLayers] = useState<DrawLayer[]>(() => migrateLayers(drawing));
  const [selection, setSelection] = useState<string[]>([]);
  const selectionRef = useRef<string[]>(selection);
  // ─── Sélection niveau 2 (sous-groupe pour rotate/scale) ───
  const [focusedIds, setFocusedIds] = useState<string[]>([]);
  const focusedIdsRef = useRef(focusedIds);
  focusedIdsRef.current = focusedIds;
  const [selectSubMode, setSelectSubMode] = useState<'none' | 'rotate' | 'scale'>('none');
  // ─── État textbox unifié — remplace editingTextId + selectedTextId + focusedId ───
  const [tbState, setTbState] = useState<TextBoxSelectionState>({ kind: 'idle' });
  const tbStateRef = useRef(tbState);
  tbStateRef.current = tbState;
  const toolStateRef = useRef(toolState);
  toolStateRef.current = toolState;
  const [lastAction, setLastAction] = useState<string>('—');
  const setTbStateWithLog = useCallback((next: TextBoxSelectionState, source: string) => {
    console.log(`[tbState] ${tbState.kind} → ${next.kind} (${source})`);
    if (debug) {
      setLastAction(source);
    }
    setTbState(next);
  }, [tbState.kind, debug]);
  const setTbStateWithLogRef = useRef(setTbStateWithLog);
  setTbStateWithLogRef.current = setTbStateWithLog;
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [drawingName, setDrawingName] = useState(drawing.name);

  // ─── Autosave ─────────────────────────────────────────────────────────────
  const { saveNow, scheduleSave, layersRef, canvasBgRef, drawingNameRef, isDirtyRef } = useAutosave({
    drawing, storage, setIsDirty,
  });
  layersRef.current = layers;
  canvasBgRef.current = canvasBackground;
  drawingNameRef.current = drawingName;

  selectionRef.current = selection;

  // Nettoyer focusedIds — retirer les objets qui ne sont plus dans la sélection
  useEffect(() => {
    const filtered = focusedIds.filter(id => selection.includes(id));
    if (filtered.length !== focusedIds.length) {
      setFocusedIds(filtered);
      if (filtered.length === 0) setSelectSubMode('none');
    }
  }, [selection, focusedIds]);

  // ─── Refs DOM ──────────────────────────────────────────────────────────────
  const barsRef = useRef<HTMLDivElement>(null);

  // ─── Viewport ─────────────────────────────────────────────────────────────
  const { stageRef, stageSize, zoomPct, setZoomPct, canvasH, TOPBAR_H, DRAWINGBAR_H, centerViewOn, zoomTo } = useStageViewport();
  const centerViewOnRef = useRef(centerViewOn);
  centerViewOnRef.current = centerViewOn;

  // ─── Undo / Redo ──────────────────────────────────────────────────────────
  const { pushUndo, undo, redo, canUndo, canRedo } = useUndoRedo({
    initialLayers: migrateLayers(drawing),
    setLayers,
    scheduleSave,
  });

  const editingCreatedAtRef = useRef<number>(0);
  // Guard : timestamp de la dernière saisie texte — empêche un blur parasite (mobile)
  // de tuer l'édition avant que React ait rendu le nouveau layers (layersRef stale)
  const lastInputRef = useRef<number>(0);

  // Dériver les IDs courants depuis tbState (source unique de vérité)
  const editingTextId = tbState.kind === 'editing' ? tbState.id : null;
  const editingTextIdRef = useRef<string | null>(null);
  editingTextIdRef.current = editingTextId;
  const exitEditing = useCallback(() => {
    // Guard : ignorer un blur arrivant moins de 300ms après la création
    // (touchend du Stage qui blur la textarea fraîchement créée)
    if (Date.now() - editingCreatedAtRef.current < 300) return;
    setLayers(prev =>
      // Supprimer toutes les textboxes vides (filet de sécurité — pas seulement la courante)
      prev.filter(l => l.tool !== 'text' || (l as TextLayer).text.trim() !== '')
    );
    setTbStateWithLog({ kind: 'idle' }, 'exitEditing');
    setContextPanel(null);
  }, [setContextPanel, setTbStateWithLog]);

  const collapseEditingToSelected = useCallback(() => {
    if (Date.now() - editingCreatedAtRef.current < 300) return;
    // Guard : ignorer les blurs parasites qui arrivent juste après une saisie
    // (layersRef.current n'a pas encore été mis à jour par le re-render React)
    if (Date.now() - lastInputRef.current < 150) return;
    const id = editingTextIdRef.current;
    if (!id) return;
    const layer = layersRef.current.find(l => l.id === id && l.tool === 'text') as TextLayer | undefined;
    if (!layer || layer.text.trim() === '') {
      // TB vide → cleanup + idle
      setLayers(prev => prev.filter(l => l.tool !== 'text' || (l as TextLayer).text.trim() !== ''));
      setTbStateWithLogRef.current({ kind: 'idle' }, 'collapseToSelected:empty');
      setContextPanel(null);
      return;
    }
    setTbStateWithLogRef.current({ kind: 'selected', id }, 'collapseToSelected');
  }, [setLayers, setContextPanel]);

  const addTextBox = useCallback((x: number, y: number) => {
    const tl = makeTextLayer(uuidv4(), x, y);
    const newLayers = [...layers, tl];
    setLayers(newLayers);
    pushUndo(newLayers);
    editingCreatedAtRef.current = Date.now();
    setTbStateWithLog({ kind: 'editing', id: tl.id }, 'addTextBox');
    const barsH = barsRef.current?.offsetHeight ?? 0;
    const stage = stageRef.current;
    if (stage) {
      const sc = stage.scaleX();
      stage.position(clampStagePos({ x: 20 - x * sc, y: barsH + 20 - y * sc }, sc, stage.width(), stage.height()));
      stage.batchDraw();
    }
    setContextPanel('text');
    scheduleSave();
  }, [layers, pushUndo, setContextPanel, centerViewOn]);

  const handleSetCanvasMode = useCallback((mode: CanvasMode) => {
    if (tbStateRef.current.kind !== 'idle') exitEditing();
    setCanvasMode(mode);
    setSelection([]);
    setFocusedIds([]);
    setSelectSubMode('none');
  }, [setCanvasMode, exitEditing]);

  const handleTogglePan = useCallback(() => {
    if (tbStateRef.current.kind !== 'idle') exitEditing();
    togglePan();
    setSelection([]);
    setFocusedIds([]);
    setSelectSubMode('none');
  }, [togglePan, exitEditing]);

  // Ref synchrone pour le hold-to-pan (pas de latence React)
  const holdPanActiveRef = useRef(false);

  const handleEnterPan = useCallback(() => {
    if (tbStateRef.current.kind !== 'idle') exitEditing();
    holdPanActiveRef.current = true;
    enterPan();
    setSelection([]);
    setFocusedIds([]);
    setSelectSubMode('none');
  }, [enterPan, exitEditing]);

  const handleExitPan = useCallback(() => {
    holdPanActiveRef.current = false;
    exitPan();
  }, [exitPan]);

  // ─── Button mapping (boutons physiques → actions) ──────────────────────────
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const buttonMapping = useButtonMapping({
    toggle: { toggle_pan: handleTogglePan },
    enter: { toggle_pan: handleEnterPan },
    exit: { toggle_pan: handleExitPan },
  });

  // ─── Gestures canvas ───────────────────────────────────────────────────────
  const {
    handleMouseDown, handleMouseMove, handleMouseUp, handleWheel,
    handleTapById, handleDragEnd, handleSelectItem,
    handleScaleStart, handleScaleMove, handleScaleEnd,
    handleRotateStart, handleRotateMove, handleRotateEnd,
    selRect, currentStroke, currentAirbrush, liveLineRef, textNodesRef,
  } = useCanvasGestures({
    stageRef, layersRef,
    toolStateRef, tbStateRef, editingTextIdRef, editingCreatedAtRef, selectionRef, focusedIdsRef,
    setTbStateWithLogRef, centerViewOnRef, barsRef,
    setLayers, setSelection, setFocusedIds, setContextPanel, setZoomPct,
    exitEditing, collapseEditingToSelected, addTextBox, collapsePanel,
    pushUndo, scheduleSave,
    pinchZoomEnabledRef,
    holdPanActiveRef,
    activeColor, activeWidth,
  });

  const selectedTextId = tbState.kind === 'selected' ? tbState.id : null;

  const updateTextBox = useCallback((patch: Partial<TextBox>) => {
    const targetId = editingTextId ?? selectedTextId;
    if (!targetId) return;
    if ('text' in patch) lastInputRef.current = Date.now();
    setLayers(prev => prev.map(l => {
      if (l.tool !== 'text' || l.id !== targetId) return l;
      return { ...l, ...patch };
    }));
    scheduleSave();
  }, [editingTextId, selectedTextId]);

  const deleteItem = useCallback((id: string) => {
    const newL = layers.filter(l => l.id !== id);
    setLayers(newL);
    setSelection(prev => prev.filter(x => x !== id));
    if (tbState.kind !== 'idle' && tbState.id === id) setTbStateWithLog({ kind: 'idle' }, 'deleteItem');
    pushUndo(newL); scheduleSave();
  }, [layers, tbState, pushUndo, setTbStateWithLog]);

  const duplicateTextBox = useCallback(() => {
    const id = tbState.kind === 'selected' ? tbState.id : tbState.kind === 'editing' ? tbState.id : null;
    if (!id) return;
    const tb = layers.find(l => l.id === id && l.tool === 'text') as TextLayer | undefined;
    if (!tb) return;
    const newId = uuidv4();
    const dup: TextLayer = { ...tb, id: newId, y: tb.y - 20 };
    const newLayers = [...layers, dup];
    setLayers(newLayers);
    pushUndo(newLayers);
    setTbStateWithLog({ kind: 'selected', id: newId }, 'duplicateTextBox');
    setContextPanel('text');
    scheduleSave();
  }, [layers, tbState, pushUndo, setTbStateWithLog, setContextPanel, scheduleSave]);

  const deleteSelected = useCallback(() => {
    const newL = layers.filter(l => !selection.includes(l.id));
    setLayers(newL);
    setSelection([]); setTbStateWithLog({ kind: 'idle' }, 'deleteSelected');
    pushUndo(newL); scheduleSave();
  }, [layers, selection, pushUndo, setTbStateWithLog]);

  const handleSave = () => {
    setIsSaving(true);
    isDirtyRef.current = true; // force save même si déjà propre
    saveNow();
    setIsSaving(false);
  };

  const handleExportSvg = () => {
    exportSvg(layers, A4_WIDTH, A4_HEIGHT, `${drawingName}.svg`, canvasBackground);
  };

  const handleRename = (newName: string) => {
    setDrawingName(newName);
    storage.rename(drawing.id, newName);
    scheduleSave();
  };

  const handleDeleteDrawing = () => {
    if (!confirm(`Supprimer "${drawingName}" ? Cette action est irréversible.`)) return;
    storage.remove(drawing.id);
    onBack();
  };

  const editingTextBox = editingTextId
    ? (layers.find(l => l.id === editingTextId && l.tool === 'text') as TextLayer | undefined) ?? null
    : null;

  const activeTextBox = editingTextBox
    ?? (selectedTextId ? (layers.find(l => l.id === selectedTextId && l.tool === 'text') as TextLayer | undefined) ?? null : null);

  // Compense vv.offsetTop sur les barres : quand Chrome ajuste le visual viewport (textarea
  // qui grandit, TB en bas du canvas), position:fixed;top:0 passe au-dessus du visual viewport.
  // On met à jour style.top = vv.offsetTop pour que les barres restent visibles.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      if (barsRef.current) barsRef.current.style.top = `${vv.offsetTop}px`;
    };
    vv.addEventListener('scroll', update);
    return () => vv.removeEventListener('scroll', update);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#f0f0f0' }}>

      {/* Barres en haut — dans le flux normal */}
      <div data-bars ref={barsRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 210, background: '#fff' }}>
        <Topbar
          drawingName={drawingName}
          canUndo={canUndo}
          canRedo={canRedo}
          debug={debug}
          pinchZoom={pinchZoom}
          onBack={() => { saveNow(); onBack(); }}
          onUndo={undo}
          onRedo={redo}
          onExportSvg={handleExportSvg}
          onRename={handleRename}
          onDelete={handleDeleteDrawing}
          onToggleDebug={() => setDebug(d => !d)}
          onTogglePinchZoom={() => setPinchZoom(p => !p)}
          onOpenButtonMapping={() => setMappingModalOpen(true)}
        />

        {!(toolState.canvasMode === 'select' && selection.length > 0) && (
          <Drawingbar
            state={toolState}
            canvasBackground={canvasBackground}
            contextPanel={contextPanel}
            onSelectDrawingTool={t => { if (tbStateRef.current.kind !== 'idle') { exitEditing(); } selectDrawingTool(t); }}
            onSelectText={selectTextTool}
            onSelectEraser={() => { if (tbStateRef.current.kind !== 'idle') { exitEditing(); } selectEraser(); }}
            onSelectBackground={selectBackground}
            onSwipeOpen={(target) => {
              if (target === 'eraser') return;
              if (target === 'text') { selectTextTool(); setContextPanel('text'); }
              else if (target === 'background') { selectBackground(); }
              else if (['airbrush', 'pen', 'marker'].includes(target)) {
                selectDrawingTool(target as DrawingTool);
                setContextPanel('drawing');
              }
            }}
            onSwipeClose={collapsePanel}
          />
        )}

        <ContextToolbar
          contextPanel={contextPanel}
          state={toolState}
          canvasBackground={canvasBackground}
          textBox={activeTextBox}
          onSetToolColor={setToolColor}
          onSetToolWidth={setToolWidth}
          onSetToolOpacity={setToolOpacity}
          onSetAirbrushEdgeOpacity={setAirbrushEdgeOpacity}
          onSetToolSmoothing={setToolSmoothing}
          onSetBackground={setCanvasBackground}
          onUpdateTextBox={updateTextBox}
          onDuplicateTextBox={duplicateTextBox}
          onSwipeClose={collapsePanel}
        />

        {toolState.canvasMode === 'select' && selection.length > 0 && (
          <SelectionPanel
            layers={layers}
            selection={selection}
            focusedIds={focusedIds}
            selectSubMode={selectSubMode}
            onFocus={id => {
              setFocusedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
              setSelectSubMode('none');
            }}
            onSetSelectSubMode={mode => {
              setSelectSubMode(prev => prev === mode ? 'none' : mode);
            }}
            onDeselect={id => {
              setSelection(prev => prev.filter(x => x !== id));
              if (tbState.kind !== 'idle' && tbState.id === id) setTbStateWithLog({ kind: 'idle' }, 'selectionPanel:deselect');
            }}
            onDeleteItem={deleteItem}
            onDeleteSelected={deleteSelected}
            onClearSelection={() => { setSelection([]); setFocusedIds([]); setSelectSubMode('none'); setTbStateWithLog({ kind: 'idle' }, 'selectionPanel:clear'); }}
            onReorderByIds={orderedIds => {
              // orderedIds est en ordre panel (z décroissant, top-of-stack en premier).
              // layers est en z croissant → inverser pour aligner les deux ordres.
              const reversedIds = [...orderedIds].reverse();
              const selectedSet = new Set(reversedIds);
              const byId = new Map(layers.map(l => [l.id, l]));
              const origIndices = layers
                .map((l, i) => (selectedSet.has(l.id) ? i : -1))
                .filter(i => i !== -1);
              const newLayers = [...layers];
              origIndices.forEach((origIdx, rank) => {
                const item = byId.get(reversedIds[rank]);
                if (item) newLayers[origIdx] = item;
              });
              setLayers(newLayers);
              pushUndo(newLayers);
              scheduleSave();
            }}
          />
        )}
      </div>

      {/* Canvas — position absolue, top = hauteur des barres fixe */}
      {/* Drawingbar masquée quand le SelectionPanel est affiché → top = TOPBAR_H seul */}
      <div style={{
        position: 'absolute',
        top: (toolState.canvasMode === 'select' && selection.length > 0) ? TOPBAR_H : TOPBAR_H + DRAWINGBAR_H,
        left: 0, right: 0, bottom: 0,
        background: '#e0e0e0',
        overflow: 'hidden',
        touchAction: 'none',
        cursor: toolState.canvasMode === 'move' ? 'grab' : 'crosshair',
      }}>
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={canvasH}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
          onWheel={handleWheel}
        >
          <DrawingLayer
            canvasBackground={canvasBackground}
            layers={layers}
            selection={selection}
            focusedIds={focusedIds}
            selectSubMode={selectSubMode}
            stageScale={zoomPct / 100}
            tbState={tbState}
            canvasMode={toolState.canvasMode}
            currentStroke={currentStroke}
            currentAirbrush={currentAirbrush}
            liveLineRef={liveLineRef}
            selRect={selRect}
            stageRef={stageRef}
            textNodesRef={textNodesRef}
            onSelectItem={handleSelectItem}
            onTapById={handleTapById}
            onLayerUpdate={setLayers}
            onDragEnd={handleDragEnd}
            onScaleStart={handleScaleStart}
            onScaleMove={handleScaleMove}
            onScaleEnd={handleScaleEnd}
            onRotateStart={handleRotateStart}
            onRotateMove={handleRotateMove}
            onRotateEnd={handleRotateEnd}
          />
        </Stage>

      </div>

      {/* Textarea édition texte — en position fixed pour ne pas être clippée par overflow:hidden du canvas div */}
      {editingTextBox && (
        <EditingTextarea
          textBox={editingTextBox}
          stageRef={stageRef}
          topOffset={barsRef.current?.offsetHeight ?? (TOPBAR_H + DRAWINGBAR_H)}
          onUpdate={updateTextBox}
          onExit={exitEditing}
          onBlurExit={collapseEditingToSelected}
        />
      )}

      {debug && (
        <div style={{
          position: 'fixed', left: 0, right: 0,
          bottom: debugBottomOffset,
          background: 'rgba(0,0,0,0.82)',
          color: '#0f0', fontFamily: 'monospace', fontSize: 11,
          padding: '6px 10px', zIndex: 9999,
          pointerEvents: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {`tbState=${tbState.kind}${tbState.kind !== 'idle' ? ` id=${(tbState as { kind: string; id: string }).id?.slice(0, 6)}` : ''}`}
          {` | tool=${toolState.activeTool}`}
          {` | mode=${toolState.canvasMode}`}
          {` | holdPan=${holdPanActiveRef.current ? '●' : '○'}`}
          {` | zoom=${Math.round(zoomPct)}%`}
          {` | layers=${layers.length}`}
          {` | dirty=${isDirty ? '●' : '○'}`}
          {` | action=${lastAction}`}
          {'\n'}
          {activePointers.size === 0
            ? 'pointers: none'
            : Array.from(activePointers.entries()).map(([id, p], i) =>
                `${i === 0 ? 'A' : i === 1 ? 'B' : String.fromCharCode(65 + i)}:${p.target}(${p.x},${p.y})`
              ).join(' | ')
          }
        </div>
      )}

      <ActionFABs
        canvasMode={toolState.canvasMode}
        zoomPct={zoomPct}
        onSetMode={handleSetCanvasMode}
        onTogglePan={handleTogglePan}
        onEnterPan={handleEnterPan}
        onExitPan={handleExitPan}
        onZoomChange={zoomTo}
      />

      {mappingModalOpen && (
        <ButtonMappingModal
          mappings={buttonMapping.mappings}
          listening={buttonMapping.listening}
          actionLabels={buttonMapping.ACTION_LABELS}
          onStartListening={buttonMapping.startListening}
          onStopListening={buttonMapping.stopListening}
          onSetAction={buttonMapping.setAction}
          onRemoveMapping={buttonMapping.removeMapping}
          onClearAll={buttonMapping.clearAll}
          onClose={() => { buttonMapping.stopListening(); setMappingModalOpen(false); }}
        />
      )}
    </div>
  );
}
