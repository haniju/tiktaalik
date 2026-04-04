import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { Drawing, DrawLayer, TextBox, TextLayer, CanvasMode } from '../types';
import { useToolState } from '../hooks/useToolState';
import { useDrawingStorage } from '../hooks/useDrawingStorage';
import { useAutosave } from '../hooks/useAutosave';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useStageViewport } from '../hooks/useStageViewport';
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

// Version de l'application (source unique : package.json)
const APP_VERSION = __APP_VERSION__;

const DEBUG = true;

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
    setCanvasMode, collapsePanel,
    setToolColor, setToolWidth,
    activeColor, activeWidth,
    // compat (non utilisé directement dans ce composant)
  } = useToolState();

  const [canvasBackground, setCanvasBackground] = useState(drawing.background ?? '#ffffff');
  const [layers, setLayers] = useState<DrawLayer[]>(() => migrateLayers(drawing));
  const [selection, setSelection] = useState<string[]>([]);
  const selectionRef = useRef<string[]>(selection);
  // ─── État textbox unifié — remplace editingTextId + selectedTextId + focusedId ───
  const [tbState, setTbState] = useState<TextBoxSelectionState>({ kind: 'idle' });
  const tbStateRef = useRef(tbState);
  tbStateRef.current = tbState;
  const toolStateRef = useRef(toolState);
  toolStateRef.current = toolState;
  const [lastAction, setLastAction] = useState<string>('—');
  const setTbStateWithLog = useCallback((next: TextBoxSelectionState, source: string) => {
    if (DEBUG) {
      console.log(`[tbState] ${tbState.kind} → ${next.kind} (${source})`);
      setLastAction(source);
    }
    setTbState(next);
  }, [tbState.kind]);
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

  // ─── Viewport ─────────────────────────────────────────────────────────────
  const { stageRef, stageSize, zoomPct, setZoomPct, canvasH, TOPBAR_H, DRAWINGBAR_H, centerViewOn } = useStageViewport();
  const centerViewOnRef = useRef(centerViewOn);
  centerViewOnRef.current = centerViewOn;

  // ─── Undo / Redo ──────────────────────────────────────────────────────────
  const { pushUndo, undo, redo, canUndo, canRedo } = useUndoRedo({
    initialLayers: migrateLayers(drawing),
    setLayers,
    scheduleSave,
  });

  const editingCreatedAtRef = useRef<number>(0);

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
    centerViewOn(x + 340 / 2, y + 20, true);
    setContextPanel('text');
    scheduleSave();
  }, [layers, pushUndo, setContextPanel, centerViewOn]);

  const handleSetCanvasMode = useCallback((mode: CanvasMode) => {
    if (tbStateRef.current.kind !== 'idle') exitEditing();
    setCanvasMode(mode);
    setSelection([]);
  }, [setCanvasMode, exitEditing]);

  // ─── Gestures canvas ───────────────────────────────────────────────────────
  const {
    handleMouseDown, handleMouseMove, handleMouseUp, handleWheel,
    handleTapById, handleDragEnd, handleSelectItem,
    selRect, currentStroke, currentAirbrush, textNodesRef,
  } = useCanvasGestures({
    stageRef, layersRef,
    toolStateRef, tbStateRef, editingTextIdRef, editingCreatedAtRef, selectionRef,
    setTbStateWithLogRef, centerViewOnRef,
    setLayers, setSelection, setContextPanel, setZoomPct,
    exitEditing, collapseEditingToSelected, addTextBox, collapsePanel,
    pushUndo, scheduleSave,
    activeColor, activeWidth,
  });

  const updateTextBox = useCallback((patch: Partial<TextBox>) => {
    setLayers(prev => prev.map(l => {
      if (l.tool !== 'text' || l.id !== editingTextId) return l;
      return { ...l, ...patch };
    }));
    scheduleSave();
  }, [editingTextId]);

  const deleteItem = useCallback((id: string) => {
    const newL = layers.filter(l => l.id !== id);
    setLayers(newL);
    setSelection(prev => prev.filter(x => x !== id));
    if (tbState.kind !== 'idle' && tbState.id === id) setTbStateWithLog({ kind: 'idle' }, 'deleteItem');
    pushUndo(newL); scheduleSave();
  }, [layers, tbState, pushUndo, setTbStateWithLog]);

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

  const handleRename = () => {
    const newName = prompt('Nouveau nom :', drawingName);
    if (newName && newName.trim()) {
      setDrawingName(newName.trim());
      storage.rename(drawing.id, newName.trim());
      scheduleSave();
    }
  };

  const handleDeleteDrawing = () => {
    if (!confirm(`Supprimer "${drawingName}" ? Cette action est irréversible.`)) return;
    storage.remove(drawing.id);
    onBack();
  };

  const editingTextBox = editingTextId
    ? (layers.find(l => l.id === editingTextId && l.tool === 'text') as TextLayer | undefined) ?? null
    : null;
  const barsRef = useRef<HTMLDivElement>(null);

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
          onBack={() => { saveNow(); onBack(); }}
          onUndo={undo}
          onRedo={redo}
          onExportSvg={handleExportSvg}
          onRename={handleRename}
          onDelete={handleDeleteDrawing}
        />

        <Drawingbar
          state={toolState}
          canvasBackground={canvasBackground}
          contextPanel={contextPanel}
          onSelectDrawingTool={t => { if (tbStateRef.current.kind !== 'idle') { exitEditing(); } selectDrawingTool(t); }}
          onSelectText={selectTextTool}
          onSelectEraser={() => { if (tbStateRef.current.kind !== 'idle') { exitEditing(); } selectEraser(); }}
          onSelectBackground={selectBackground}
        />

        <ContextToolbar
          contextPanel={contextPanel}
          state={toolState}
          canvasBackground={canvasBackground}
          textBox={editingTextBox}
          onSetToolColor={setToolColor}
          onSetToolWidth={setToolWidth}
          onSetBackground={setCanvasBackground}
          onUpdateTextBox={updateTextBox}
          onAddTextBox={() => {
            // Créer au centre du canvas visible
            const stage = stageRef.current;
            if (!stage) return;
            const sc = stage.scaleX(), sp = stage.position();
            const cx = (stageSize.width / 2 - sp.x) / sc;
            const cy = (canvasH / 2 - sp.y) / sc;
            addTextBox(cx - 100, cy - 20);
          }}
        />

        {toolState.canvasMode === 'select' && selection.length > 0 && (
          <SelectionPanel
            layers={layers}
            selection={selection}
            focusedId={tbState.kind !== 'idle' ? tbState.id : null}
            onFocus={id => {
              const next: TextBoxSelectionState = tbState.kind !== 'idle' && tbState.id === id
                ? { kind: 'idle' }
                : { kind: 'selected', id };
              setTbStateWithLog(next, 'selectionPanel:focus');
            }}
            onDeselect={id => {
              setSelection(prev => prev.filter(x => x !== id));
              if (tbState.kind !== 'idle' && tbState.id === id) setTbStateWithLog({ kind: 'idle' }, 'selectionPanel:deselect');
            }}
            onDeleteItem={deleteItem}
            onDeleteSelected={deleteSelected}
            onClearSelection={() => { setSelection([]); setTbStateWithLog({ kind: 'idle' }, 'selectionPanel:clear'); }}
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

      {/* Canvas — position absolue, top = hauteur des barres fixe (topbar + drawingbar) */}
      {/* On utilise paddingTop pour pousser le contenu sous les barres sans que le canvas resize */}
      <div style={{
        position: 'absolute',
        top: TOPBAR_H + DRAWINGBAR_H,
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
            tbState={tbState}
            canvasMode={toolState.canvasMode}
            currentStroke={currentStroke}
            currentAirbrush={currentAirbrush}
            selRect={selRect}
            stageRef={stageRef}
            textNodesRef={textNodesRef}
            onSelectItem={handleSelectItem}
            onTapById={handleTapById}
            onLayerUpdate={setLayers}
            onDragEnd={handleDragEnd}
          />
        </Stage>

        {/* Badge zoom */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
          padding: '4px 10px', borderRadius: 20,
          pointerEvents: 'none', zIndex: 10,
        }}>
          {zoomPct} %
        </div>

        {/* Badge version */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.7)',
          fontSize: 11, fontWeight: 500, letterSpacing: 0.2,
          padding: '4px 10px', borderRadius: 20,
          pointerEvents: 'none', zIndex: 10,
        }}>
          v{APP_VERSION}
        </div>

      </div>

      {/* Textarea édition texte — en position fixed pour ne pas être clippée par overflow:hidden du canvas div */}
      {editingTextBox && (
        <EditingTextarea
          textBox={editingTextBox}
          stageRef={stageRef}
          topOffset={TOPBAR_H + DRAWINGBAR_H}
          onUpdate={updateTextBox}
          onExit={exitEditing}
          onBlurExit={collapseEditingToSelected}
        />
      )}

      {DEBUG && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.82)',
          color: '#0f0', fontFamily: 'monospace', fontSize: 11,
          padding: '6px 10px', zIndex: 9999,
          pointerEvents: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {`tbState=${tbState.kind}${tbState.kind !== 'idle' ? ` id=${(tbState as { kind: string; id: string }).id?.slice(0, 6)}` : ''}`}
          {` | tool=${toolState.activeTool}`}
          {` | mode=${toolState.canvasMode}`}
          {` | zoom=${Math.round(zoomPct)}%`}
          {` | layers=${layers.length}`}
          {` | dirty=${isDirty ? '●' : '○'}`}
          {` | action=${lastAction}`}
        </div>
      )}

      <ActionFABs
        canvasMode={toolState.canvasMode}
        isDirty={isDirty}
        isSaving={isSaving}
        onSetMode={handleSetCanvasMode}
        onSave={handleSave}
      />
    </div>
  );
}
