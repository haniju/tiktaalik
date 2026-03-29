import React, { useRef, useState, useEffect, useCallback } from 'react';
import Konva from 'konva';
import { Stage, Layer, Line, Rect, Text, Group } from 'react-konva';
import { v4 as uuidv4 } from 'uuid';
import { Drawing, DrawLayer, Stroke, AirbrushStroke, TextBox, TextLayer, CanvasMode } from '../types';
import { useToolState } from '../hooks/useToolState';
import { useDrawingStorage } from '../hooks/useDrawingStorage';
import { exportSvg, generateThumbnail } from '../utils/export';
import { AIRBRUSH_CONFIG } from '../utils/airbrushConfig';
import {
  TextBoxSelectionState,
  nextSelectionState,
  estimateTextHeight,
  findTextBoxAtPoint,
  isRectIntersecting,
} from '../utils/textboxUtils';
import { Topbar } from './Topbar';
import { Drawingbar } from './Drawingbar';
import { ContextToolbar } from './ContextToolbar';
import { SelectionPanel } from './SelectionPanel';
import { AirbrushShape, AirbrushOutline } from './AirbrushLayer';
import { ActionFABs } from './ActionFABs';

// Version de l'application (source unique : package.json)
const APP_VERSION = __APP_VERSION__;

const DEBUG = true;

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const HANDLE_W = 12;  // largeur du handle resize
const HANDLE_H = 28;  // hauteur du handle resize
const BORDER_HIT = 14; // épaisseur zone hit des bords pour drag

interface ResizeHandleProps {
  cx: number; cy: number;
  side: 'left' | 'right';
  tb: { x: number; y: number; width: number };
  stageRef: React.RefObject<Konva.Stage>;
  onMove: (newX: number, newWidth: number) => void;
  onDragEnd: () => void;
}

// Taille minimale du handle à l'écran (px) — garantit qu'il reste touchable même dézoomé
// Taille fixe des handles à l'écran (px) — indépendante du zoom
const HANDLE_SCREEN_W = 30;
const HANDLE_SCREEN_H = 36;

// Handle de resize horizontal — milieu bord gauche ou droit
function ResizeHandle({ cx, cy, side, tb, stageRef, onMove, onDragEnd }: ResizeHandleProps) {
  const dragStartRef = useRef<{
    pointerX: number;      // position écran (absolutePosition) au démarrage
    lockedScreenY: number; // position Y écran verrouillée pour toute la durée du drag
    tbX: number;           // tb.x au démarrage
    tbWidth: number;       // tb.width au démarrage
  } | null>(null);
  // Compenser le zoom : la taille en coordonnées canvas augmente quand on dézoome
  const sc = stageRef.current?.scaleX() ?? 1;
  const hw = HANDLE_SCREEN_W / sc;
  const hh = HANDLE_SCREEN_H / sc;

  return (
    <Rect
      x={cx - hw / 2} y={cy - hh / 2}
      width={hw} height={hh}
      fill="#118ab2" opacity={0.85} cornerRadius={4}
      draggable
      dragBoundFunc={pos => ({
        x: pos.x,
        y: dragStartRef.current?.lockedScreenY ?? pos.y,
      })}
      onDragStart={e => {
        dragStartRef.current = {
          pointerX: e.target.absolutePosition().x,
          lockedScreenY: e.target.absolutePosition().y,
          tbX: tb.x,
          tbWidth: tb.width,
        };
      }}
      onDragMove={e => {
        if (!dragStartRef.current) return;
        const stage = stageRef.current!;
        const scl = stage.scaleX();
        const abs = e.target.absolutePosition();
        const dxCanvas = (abs.x - dragStartRef.current.pointerX) / scl;

        if (side === 'left') {
          const newX = dragStartRef.current.tbX + dxCanvas;
          const newWidth = Math.max(dragStartRef.current.tbWidth - dxCanvas, 150);
          onMove(newX, newWidth);
        } else {
          const newWidth = Math.max(dragStartRef.current.tbWidth + dxCanvas, 150);
          onMove(dragStartRef.current.tbX, newWidth);
        }
      }}
      onDragEnd={e => {
        dragStartRef.current = null;
        e.target.position({ x: cx - hw / 2, y: cy - hh / 2 });
        onDragEnd();
      }}
      onMouseEnter={() => { if (stageRef.current) stageRef.current.container().style.cursor = 'ew-resize'; }}
      onMouseLeave={() => { if (stageRef.current) stageRef.current.container().style.cursor = ''; }}
    />
  );
}

interface Props {
  drawing: Drawing;
  onBack: () => void;
}


const makeTextLayer = (id: string, x: number, y: number): TextLayer => ({
  tool: 'text',
  id, x, y,
  width: 340,
  text: '', fontSize: 24, fontFamily: 'Arial', fontStyle: 'normal',
  textDecoration: '', align: 'left', verticalAlign: 'top',
  color: '#000000', background: '', opacity: 1, padding: 8,
});

// Migration des anciens dessins vers la pile unifiée
function migrateLayers(drawing: Drawing): DrawLayer[] {
  let layers: DrawLayer[] = drawing.layers ?? [
    ...(drawing.strokes ?? []),
    ...(drawing.airbrushStrokes ?? []),
  ];
  // Legacy textBoxes séparées (avant v1.3)
  if (drawing.textBoxes && drawing.textBoxes.length > 0) {
    const alreadyMigrated = layers.some(l => l.tool === 'text');
    if (!alreadyMigrated) {
      layers = [...layers, ...drawing.textBoxes.map(tb => ({ ...tb, tool: 'text' as const }))];
    }
  }
  return layers;
}

export function SketchScreen({ drawing, onBack }: Props) {
  const storage = useDrawingStorage();
  const stageRef = useRef<Konva.Stage>(null);

  const {
    state: toolState, contextPanel, setContextPanel,
    selectDrawingTool, selectTextTool, selectEraser, selectBackground,
    setCanvasMode, collapsePanel,
    setToolColor, setToolWidth,
    activeColor, activeWidth,
    // compat (non utilisé directement dans ce composant)
  } = useToolState();

  const [canvasBackground, setCanvasBackground] = useState(drawing.background ?? '#ffffff');
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [layers, setLayers] = useState<DrawLayer[]>(() => migrateLayers(drawing));
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [currentAirbrush, setCurrentAirbrush] = useState<AirbrushStroke | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const selectionRef = useRef<string[]>(selection);
  // ─── État textbox unifié — remplace editingTextId + selectedTextId + focusedId ───
  const [tbState, setTbState] = useState<TextBoxSelectionState>({ kind: 'idle' });
  const tbStateRef = useRef(tbState);
  tbStateRef.current = tbState;
  const [lastAction, setLastAction] = useState<string>('—');
  const setTbStateWithLog = useCallback((next: TextBoxSelectionState, source: string) => {
    if (DEBUG) {
      console.log(`[tbState] ${tbState.kind} → ${next.kind} (${source})`);
      setLastAction(source);
    }
    setTbState(next);
  }, [tbState.kind]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [drawingName, setDrawingName] = useState(drawing.name);
  const [undoStack, setUndoStack] = useState(() => [{ layers: migrateLayers(drawing) }]);
  const [undoIndex, setUndoIndex] = useState(0);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // ─── Autosave ─────────────────────────────────────────────────────────────
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const canvasBgRef = useRef(canvasBackground);
  canvasBgRef.current = canvasBackground;
  const drawingNameRef = useRef(drawingName);
  drawingNameRef.current = drawingName;
  const isDirtyRef = useRef(false);

  const saveNow = useCallback(() => {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    if (!isDirtyRef.current) return;
    const bg = canvasBgRef.current;
    const thumb = generateThumbnail(layersRef.current, A4_WIDTH, A4_HEIGHT, bg);
    storage.save({ ...drawing, name: drawingNameRef.current, layers: layersRef.current, background: bg, updatedAt: Date.now(), thumbnail: thumb });
    isDirtyRef.current = false;
    setIsDirty(false);
    console.log('[autosave]', new Date().toLocaleTimeString());
  }, [drawing, storage]);

  const scheduleSave = useCallback(() => {
    isDirtyRef.current = true;
    setIsDirty(true);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(saveNow, 4000);
  }, [saveNow]);

  // Save immédiat sur visibilitychange / beforeunload
  useEffect(() => {
    const onVisChange = () => { if (document.hidden) saveNow(); };
    const onBeforeUnload = () => saveNow();
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [saveNow]);

  selectionRef.current = selection;
  const selRectStart = useRef<{ x: number; y: number } | null>(null);
  const isDraggingSelection = useRef(false);
  const dragArmed = useRef(false); // sélectionné touché, en attente de confirmation par mouvement
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragPointerStart = useRef<{ x: number; y: number } | null>(null); // position écran pour seuil mouvement
  const dragLayerSnapshot = useRef<DrawLayer[]>([]);
  const dragSelectionRef = useRef<string[]>([]); // ids à déplacer (select mode = selectionRef, text mode = [tbState.id])
  const dragLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDrawing = useRef(false);
  const isErasing = useRef(false);
  const lastAirbrushPt = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);

  // Pinch zoom — 2 doigts
  const pinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);

  // Position du tap texte en attente — création différée au touchend pour ignorer les pinches
  const pendingTextboxRef = useRef<{ x: number; y: number } | null>(null);

  // Refs vers les nœuds Text Konva — lecture directe des dimensions au render
  const textNodesRef = useRef<Map<string, Konva.Text>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  // Hauteurs fixes des barres — le canvas est positionné absolument sous elles
  const TOPBAR_H = 48;
  const DRAWINGBAR_H = 48;
  // canvasH = hauteur totale moins les deux barres fixes (ContextToolbar et SelectionPanel flottent par-dessus)
  const canvasH = stageSize.height - TOPBAR_H - DRAWINGBAR_H;

  useEffect(() => {
    const fn = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [zoomPct, setZoomPct] = useState(200);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sc = 2.0; // 200% par défaut
    stage.scale({ x: sc, y: sc });
    stage.position({
      x: (stageSize.width - A4_WIDTH * sc) / 2,
      y: (canvasH - A4_HEIGHT * sc) / 2,
    });
    stage.batchDraw();
    setZoomPct(200);
  }, []); // stageRef/setZoomPct sont stables, le tableau vide est intentionnel

  // Translate le Stage pour centrer (cx, cy) dans la zone visible — zoom inchangé
  const centerViewOn = useCallback((cx: number, cy: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const sc = stage.scaleX();
    const visibleCx = (stageSize.width / 2 - stage.x()) / sc;
    const visibleCy = (canvasH / 2 - stage.y()) / sc;
    const threshold = Math.min(stageSize.width, canvasH) * 0.2 / sc;
    if (Math.hypot(cx - visibleCx, cy - visibleCy) < threshold) return;
    const newX = stageSize.width / 2 - cx * sc;
    const newY = canvasH / 2 - cy * sc;
    stage.to({ x: newX, y: newY, duration: 0.15, easing: Konva.Easings.EaseOut });
  }, [stageSize.width, canvasH]);

  const pushUndo = useCallback((l: DrawLayer[]) => {
    setUndoStack(prev => {
      const next = [...prev.slice(0, undoIndex + 1), { layers: l }];
      setUndoIndex(next.length - 1);
      return next;
    });
  }, [undoIndex]);

  const undo = useCallback(() => {
    if (undoIndex <= 0) return;
    const i = undoIndex - 1;
    setUndoIndex(i);
    setLayers(undoStack[i].layers);
    scheduleSave();
  }, [undoIndex, undoStack]);

  const redo = useCallback(() => {
    if (undoIndex >= undoStack.length - 1) return;
    const i = undoIndex + 1;
    setUndoIndex(i);
    setLayers(undoStack[i].layers);
    scheduleSave();
  }, [undoIndex, undoStack]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { if (e.shiftKey) { redo(); } else { undo(); } }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [undo, redo]);

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

  const addTextBox = useCallback((x: number, y: number) => {
    const tl = makeTextLayer(uuidv4(), x, y);
    const newLayers = [...layers, tl];
    setLayers(newLayers);
    pushUndo(newLayers);
    editingCreatedAtRef.current = Date.now();
    setTbStateWithLog({ kind: 'editing', id: tl.id }, 'addTextBox');
    centerViewOn(x + 340 / 2, y + 20);
    setContextPanel('text');
    scheduleSave();
  }, [layers, pushUndo, setContextPanel, centerViewOn]);

  const handleSetCanvasMode = useCallback((mode: CanvasMode) => {
    if (tbStateRef.current.kind !== 'idle') exitEditing();
    setCanvasMode(mode);
    setSelection([]);
  }, [setCanvasMode, exitEditing]);

  // Ref pour ignorer le 1er touch d'un pinch
  const pinchPendingRef = useRef(false);
  const pinchPendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Handlers canvas ---

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current!;

    // Pinch zoom : 2 doigts détectés → ignorer le dessin
    if (e.evt instanceof TouchEvent && e.evt.touches.length === 2) {
      // Annuler tout ce qui aurait pu commencer avec le 1er doigt
      pinchPendingRef.current = false;
      if (pinchPendingTimerRef.current) { clearTimeout(pinchPendingTimerRef.current); pinchPendingTimerRef.current = null; }
      const t1 = e.evt.touches[0], t2 = e.evt.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      pinchRef.current = { dist, midX, midY };
      isDrawing.current = false;
      isErasing.current = false;
      setCurrentStroke(null);
      setCurrentAirbrush(null);
      return;
    }

    // 1 seul doigt touch : marquer "pinch pending" pendant 80ms
    // Si un 2ème doigt arrive dans ce délai, on ignore l'action du 1er doigt
    if (e.evt instanceof TouchEvent && e.evt.touches.length === 1) {
      pinchPendingRef.current = true;
      if (pinchPendingTimerRef.current) clearTimeout(pinchPendingTimerRef.current);
      pinchPendingTimerRef.current = setTimeout(() => {
        pinchPendingRef.current = false;
        pinchPendingTimerRef.current = null;
      }, 80);
      // On continue le traitement normal — si un 2ème doigt arrive il annulera via le guard ci-dessus
    }

    const pos = stage.getRelativePointerPosition()!;
    const screenPos = stage.getPointerPosition()!;

    // En mode text : si on édite et qu'on clique ailleurs → exit édition
    if (editingTextIdRef.current && toolState.activeTool === 'text') {
      exitEditing();
      return;
    }

    // Bloquer tout le reste si on édite (sauf text tool géré ci-dessus)
    if (editingTextIdRef.current) return;

    // Clic sur le fond (stage OU Rect A4) → sortir de l'édition texte (sécurité)
    const targetName = (e.target as Konva.Node).name();
    const isBackground = e.target === stage || targetName === 'background-rect';

    if (toolState.canvasMode === 'move') {
      isPanning.current = true;
      panStart.current = { x: screenPos.x, y: screenPos.y, sx: stage.x(), sy: stage.y() };
      return;
    }

    if (toolState.canvasMode === 'select') {
      if (isBackground) {
        setSelection([]);
        selRectStart.current = pos;
        setSelRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
        return;
      }
      // Trouver l'id du layer touché en remontant l'arbre Konva
      let node: Konva.Node | null = e.target;
      let hitId: string | null = null;
      while (node) {
        const nid = node.id?.();
        if (nid) { hitId = nid; break; }
        node = node.getParent?.() ?? null;
      }
      if (!hitId) return;

      const alreadySelected = selectionRef.current.includes(hitId);
      const snapPos = pos;
      const snapScreen = screenPos;

      if (alreadySelected) {
        // Armer le drag — confirmé seulement si le doigt bouge > seuil
        dragArmed.current = true;
        dragStartPos.current = snapPos;
        dragPointerStart.current = snapScreen;
        dragLayerSnapshot.current = layers.map(l => ({ ...l }));
      } else {
        // Long-press (350ms) pour les objets non sélectionnés
        dragPointerStart.current = snapScreen;
        dragLongPressTimer.current = setTimeout(() => {
          dragLongPressTimer.current = null;
          // Sélectionner l'objet puis démarrer le drag
          setSelection(prev => prev.includes(hitId!) ? prev : [...prev, hitId!]);
          selectionRef.current = selectionRef.current.includes(hitId!) ? selectionRef.current : [...selectionRef.current, hitId!];
          isDraggingSelection.current = true;
          dragStartPos.current = snapPos;
          dragLayerSnapshot.current = layers.map(l => ({ ...l }));
        }, 350);
      }
      return;
    }

    if (toolState.canvasMode !== 'draw') return;

    // Replier le panel contextuel au début du dessin (sauf text tool qui a son propre panel)
    if (toolState.activeTool !== 'text') collapsePanel();

    // En mode draw, clic sur le fond → sortir de l'édition
    if (e.target === stage && editingTextIdRef.current) {
      exitEditing();
      return;
    }

    if (toolState.activeTool === 'eraser') {
      isErasing.current = true;
      eraseAt(pos);
      return;
    }

    // Mode texte
    if (toolState.activeTool === 'text') {
      if (tbStateRef.current.kind === 'selected') {
        let node: Konva.Node | null = e.target;
        let hitId: string | null = null;
        while (node) {
          const nid = node.id?.();
          if (nid) { hitId = nid; break; }
          node = node.getParent?.() ?? null;
        }
        if (hitId === tbStateRef.current.id) {
          // Touch sur un enfant draggable (resize handle, border) → laisser son drag natif Konva
          if (e.target.draggable()) {
            return;
          }
          // Sinon armer le drag pour déplacer la textbox
          dragArmed.current = true;
          dragStartPos.current = pos;
          dragPointerStart.current = screenPos;
          dragLayerSnapshot.current = layers.map(l => ({ ...l }));
          dragSelectionRef.current = [hitId];
          return;
        }
        // Tap sur une autre textbox ou sur le fond → désélectionner (pas de création)
        exitEditing();
        if (hitId) {
          // Tap sur une autre textbox → la sélectionner
          setTbStateWithLog({ kind: 'selected', id: hitId }, 'handleMouseDown:otherTextbox');
          setContextPanel('text');
        }
        return;
      }
      // État idle → mémoriser la position pour création au touchend (guard pinch)
      pendingTextboxRef.current = { x: pos.x, y: pos.y };
      return;
    }

    if (toolState.activeTool === 'airbrush') {
      const radius = activeWidth * AIRBRUSH_CONFIG.radiusMultiplier;
      const ab: AirbrushStroke = { id: uuidv4(), tool: 'airbrush', color: activeColor, radius, centerOpacity: AIRBRUSH_CONFIG.centerOpacity, points: [{ x: pos.x, y: pos.y }] };
      setCurrentAirbrush(ab);
      lastAirbrushPt.current = pos;
      isDrawing.current = true;
      return;
    }

    if (toolState.activeTool === 'pen' || toolState.activeTool === 'marker') {
      if (editingTextIdRef.current) exitEditing();
      const opacity = toolState.activeTool === 'marker' ? 0.4 : 1;
      const w = toolState.activeTool === 'marker' ? activeWidth * 4 : activeWidth;
      setCurrentStroke({ id: uuidv4(), tool: toolState.activeTool, color: activeColor, width: w, opacity, points: [pos.x, pos.y] });
      isDrawing.current = true;
    }
  }, [toolState, activeColor, activeWidth, exitEditing, addTextBox]);

  const eraseAt = useCallback((pos: { x: number; y: number }) => {
    setLayers(prev => prev.filter(layer => {
      if (layer.tool === 'text') return true; // les textboxes ne s'effacent pas à la gomme
      if (layer.tool === 'airbrush') {
        return !layer.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < layer.radius * 0.8);
      } else {
        const pts = (layer as Stroke).points;
        for (let i = 0; i < pts.length - 2; i += 2) {
          if (Math.hypot(pts[i] - pos.x, pts[i + 1] - pos.y) < 20) return false;
        }
        return true;
      }
    }));
  }, []);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current!;

    // Pinch zoom en cours
    if (pinchRef.current && e.evt instanceof TouchEvent && e.evt.touches.length === 2) {
      const t1 = e.evt.touches[0], t2 = e.evt.touches[1];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const newMidX = (t1.clientX + t2.clientX) / 2;
      const newMidY = (t1.clientY + t2.clientY) / 2;
      const ratio = newDist / pinchRef.current.dist;
      const os = stage.scaleX();
      const ns = Math.max(0.2, Math.min(40, os * ratio));
      // Point pivot = milieu des 2 doigts
      const stageBox = stage.container().getBoundingClientRect();
      const px = newMidX - stageBox.left;
      const py = newMidY - stageBox.top;
      const mpt = { x: (px - stage.x()) / os, y: (py - stage.y()) / os };
      stage.scale({ x: ns, y: ns });
      stage.position({ x: px - mpt.x * ns, y: py - mpt.y * ns });
      stage.batchDraw();
      setZoomPct(Math.round(ns * 100));
      pinchRef.current = { dist: newDist, midX: newMidX, midY: newMidY };
      return;
    }

    if (editingTextIdRef.current) return;
    const pos = stage.getRelativePointerPosition()!;
    const screenPos = stage.getPointerPosition()!;

    if (toolState.canvasMode === 'move' && isPanning.current && panStart.current) {
      stage.position({ x: panStart.current.sx + screenPos.x - panStart.current.x, y: panStart.current.sy + screenPos.y - panStart.current.y });
      stage.batchDraw();
      return;
    }

    // Drag handling — partagé entre select mode et text mode
    if (dragArmed.current && dragPointerStart.current) {
      const ddx = screenPos.x - dragPointerStart.current.x;
      const ddy = screenPos.y - dragPointerStart.current.y;
      if (Math.hypot(ddx, ddy) > 6) {
        dragArmed.current = false;
        isDraggingSelection.current = true;
      }
    }
    // Annuler le long-press si le doigt a bougé
    if (dragLongPressTimer.current && dragPointerStart.current) {
      const ddx = screenPos.x - dragPointerStart.current.x;
      const ddy = screenPos.y - dragPointerStart.current.y;
      if (Math.hypot(ddx, ddy) > 8) {
        clearTimeout(dragLongPressTimer.current);
        dragLongPressTimer.current = null;
        dragPointerStart.current = null;
      }
    }
    if (isDraggingSelection.current && dragStartPos.current) {
      const dx = pos.x - dragStartPos.current.x;
      const dy = pos.y - dragStartPos.current.y;
      const ids = dragSelectionRef.current.length > 0 ? dragSelectionRef.current : selectionRef.current;
      const selSet = new Set(ids);
      const newLayers = dragLayerSnapshot.current.map(layer => {
        if (!selSet.has(layer.id)) return layer;
        if (layer.tool === 'text') {
          const tb = layer as TextLayer;
          return { ...tb, x: tb.x + dx, y: tb.y + dy };
        }
        if (layer.tool === 'airbrush') {
          const ab = layer as AirbrushStroke;
          return { ...ab, points: ab.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        }
        const s = layer as Stroke;
        return { ...s, points: s.points.map((v, i) => i % 2 === 0 ? v + dx : v + dy) };
      });
      setLayers(newLayers);
      return;
    }

    if (toolState.canvasMode === 'select') {
      if (selRectStart.current) {
        setSelRect({ x: Math.min(selRectStart.current.x, pos.x), y: Math.min(selRectStart.current.y, pos.y), w: Math.abs(pos.x - selRectStart.current.x), h: Math.abs(pos.y - selRectStart.current.y) });
      }
      return;
    }

    if (toolState.canvasMode !== 'draw') return;

    if (toolState.activeTool === 'eraser' && isErasing.current) { eraseAt(pos); return; }

    if (toolState.activeTool === 'airbrush' && isDrawing.current && currentAirbrush) {
      const last = lastAirbrushPt.current;
      if (last) {
        const dx = pos.x - last.x, dy = pos.y - last.y;
        const dist = Math.hypot(dx, dy);
        const step = currentAirbrush.radius * (1 - AIRBRUSH_CONFIG.pointDensity + 0.1);
        const steps = Math.max(1, Math.floor(dist / step));
        const newPts: Array<{ x: number; y: number }> = [];
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const p = { x: last.x + dx * t, y: last.y + dy * t };
          newPts.push(p);
        }
        setCurrentAirbrush(prev => prev ? { ...prev, points: [...prev.points, ...newPts] } : null);
      }
      lastAirbrushPt.current = pos;
      return;
    }

    if (isDrawing.current && currentStroke) {
      setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pos.x, pos.y] } : null);
    }
  }, [toolState, currentStroke, currentAirbrush, eraseAt]);

  const handleMouseUp = useCallback(() => {
    // Lire avant reset : pinchRef non-null = un pinch était en cours
    const wasPinch = pinchRef.current !== null;
    pinchRef.current = null;

    // Créer la textbox si c'était un vrai tap (pas un pinch)
    // Guard : vérifier qu'on ne tape pas sur une textbox existante (race condition touch :
    // handleMouseUp se déclenche AVANT handleTap sur mobile)
    if (pendingTextboxRef.current && !wasPinch) {
      const { x, y } = pendingTextboxRef.current;
      pendingTextboxRef.current = null;
      const textLayers = layers.filter((l): l is TextLayer => l.tool === 'text');
      const heights = new Map<string, number>(
        textLayers.map(t => [
          t.id,
          textNodesRef.current.get(t.id)
            ? Math.max(textNodesRef.current.get(t.id)!.height(), 20)
            : estimateTextHeight(t),
        ])
      );
      const hitTb = findTextBoxAtPoint(x, y, textLayers, heights);
      if (hitTb) {
        // Tap sur une textbox existante → appliquer la state machine, pas de création
        const next = nextSelectionState(tbStateRef.current, x, y, textLayers, heights);
        if (next.kind === 'editing' && tbStateRef.current.kind !== 'editing') {
          editingCreatedAtRef.current = Date.now();
        }
        setTbStateWithLog(next, 'handleMouseUp:tap');
        if (next.kind !== 'idle') {
          const tbH = heights.get(hitTb.id) ?? estimateTextHeight(hitTb);
          centerViewOn(hitTb.x + hitTb.width / 2, hitTb.y + tbH / 2);
          setContextPanel('text');
        }
      } else {
        addTextBox(x, y);
      }
      return;
    }
    pendingTextboxRef.current = null;

    if (editingTextIdRef.current) return;

    if (isPanning.current) { isPanning.current = false; panStart.current = null; return; }

    if (toolState.activeTool === 'eraser' && isErasing.current) {
      isErasing.current = false;
      setLayers(prev => { pushUndo(prev); return prev; });
      return;
    }

    // Drag end — partagé entre select mode et text mode
    if (dragLongPressTimer.current) {
      clearTimeout(dragLongPressTimer.current);
      dragLongPressTimer.current = null;
    }
    if (dragArmed.current) {
      dragArmed.current = false;
      dragStartPos.current = null;
      dragPointerStart.current = null;
      dragLayerSnapshot.current = [];
      dragSelectionRef.current = [];
    }
    dragPointerStart.current = null;
    if (isDraggingSelection.current) {
      isDraggingSelection.current = false;
      dragStartPos.current = null;
      dragLayerSnapshot.current = [];
      dragSelectionRef.current = [];
      pushUndo(layers);
      scheduleSave();
      return;
    }

    if (toolState.canvasMode === 'select' && selRectStart.current && selRect) {
      if (selRect.w > 5 && selRect.h > 5) {
        const selIds = layers.filter(layer => {
          if (layer.tool === 'text') return false; // géré par selT ci-dessous
          if (layer.tool === 'airbrush') {
            return layer.points.some(p => p.x >= selRect.x && p.x <= selRect.x + selRect.w && p.y >= selRect.y && p.y <= selRect.y + selRect.h);
          } else {
            const pts = (layer as Stroke).points;
            return pts.some((_, i) => i % 2 === 0 && pts[i] >= selRect.x && pts[i] <= selRect.x + selRect.w && pts[i + 1] >= selRect.y && pts[i + 1] <= selRect.y + selRect.h);
          }
        }).map(l => l.id);
        const selT = layers
          .filter((l): l is TextLayer => l.tool === 'text')
          .filter(tb => {
            const h = textNodesRef.current.get(tb.id)?.height() ?? estimateTextHeight(tb);
            return isRectIntersecting(
              { x: tb.x, y: tb.y, w: tb.width, h },
              { x: selRect.x, y: selRect.y, w: selRect.w, h: selRect.h },
            );
          })
          .map(tb => tb.id);
        setSelection([...selIds, ...selT]);
      }
      selRectStart.current = null; setSelRect(null);
      return;
    }

    if (toolState.activeTool === 'airbrush' && isDrawing.current && currentAirbrush) {
      isDrawing.current = false; lastAirbrushPt.current = null;
      const newL = [...layers, currentAirbrush];
      setLayers(newL); pushUndo(newL);
      setCurrentAirbrush(null); scheduleSave();
      return;
    }

    if (currentStroke && isDrawing.current) {
      isDrawing.current = false;
      const newL = [...layers, currentStroke];
      setLayers(newL); pushUndo(newL);
      setCurrentStroke(null); scheduleSave();
    }
  }, [toolState, selRect, layers, currentStroke, currentAirbrush, pushUndo, addTextBox, centerViewOn]);

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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#f0f0f0' }}>

      {/* Barres en haut — dans le flux normal */}
      <div data-bars ref={barsRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, background: '#fff' }}>
        <Topbar
          drawingName={drawingName}
          canUndo={undoIndex > 0}
          canRedo={undoIndex < undoStack.length - 1}
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
          onWheel={e => {
            e.evt.preventDefault();
            const stage = stageRef.current!;
            const os = stage.scaleX();
            const p = stage.getPointerPosition()!;
            const mpt = { x: (p.x - stage.x()) / os, y: (p.y - stage.y()) / os };
            const ns = Math.max(0.2, Math.min(40, os * (1 + (e.evt.deltaY > 0 ? -1 : 1) * 0.1)));
            stage.scale({ x: ns, y: ns });
            stage.position({ x: p.x - mpt.x * ns, y: p.y - mpt.y * ns });
            stage.batchDraw();
            setZoomPct(Math.round(ns * 100));
          }}
        >
          <Layer>
            <Rect x={0} y={0} width={A4_WIDTH} height={A4_HEIGHT} name="background-rect" fill={canvasBackground} shadowBlur={16} shadowColor="rgba(0,0,0,0.15)" />

            {/* Pile unifiée — ordre chronologique = z-index réel (tracés + textboxes) */}
            {layers.map(layer => {
              const isSelected = selection.includes(layer.id);
              const isFocused = tbState.kind !== 'idle' && tbState.id === layer.id;
              const selectItem = () => toolState.canvasMode === 'select' && setSelection(prev => prev.includes(layer.id) ? prev : [...prev, layer.id]);

              if (layer.tool === 'text') {
                const tb = layer as TextLayer;
                const isEditing = tbState.kind === 'editing' && tbState.id === tb.id;
                const isTextSelected = tbState.kind === 'selected' && tbState.id === tb.id;
                const isTextTool = toolState.activeTool === 'text';

                const konvaNode = textNodesRef.current.get(tb.id);
                const measuredH = konvaNode
                  ? Math.max(konvaNode.height(), 20)
                  : estimateTextHeight(tb);
                const tbH = measuredH;

                const handleTap = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
                  e.cancelBubble = true;
                  // Annuler la création d'une nouvelle textbox — on interagit avec une existante
                  pendingTextboxRef.current = null;
                  if (toolState.canvasMode === 'select') { selectItem(); return; }
                  if (!isTextTool) return;
                  if (pinchPendingRef.current && e.evt instanceof TouchEvent) return;

                  // Détection double tap (< 300ms sur la même textbox)
                  const now = Date.now();
                  const isDoubleTap = lastTapRef.current?.id === tb.id && now - lastTapRef.current.time < 300;
                  lastTapRef.current = { id: tb.id, time: now };

                  const heights = new Map(
                    layers
                      .filter((l): l is TextLayer => l.tool === 'text')
                      .map(t => [
                        t.id,
                        textNodesRef.current.get(t.id)
                          ? Math.max(textNodesRef.current.get(t.id)!.height(), 20)
                          : estimateTextHeight(t),
                      ])
                  );

                  const stage = stageRef.current!;
                  const pos = stage.getRelativePointerPosition()!;
                  const textLayers = layers.filter((l): l is TextLayer => l.tool === 'text');
                  let next = nextSelectionState(tbState, pos.x, pos.y, textLayers, heights);

                  // Double tap override : si résultat [selected], forcer [editing]
                  if (isDoubleTap && next.kind === 'selected') {
                    next = { kind: 'editing', id: next.id };
                  }

                  if (next.kind === 'editing' && tbState.kind !== 'editing') {
                    editingCreatedAtRef.current = Date.now();
                  }
                  if (tbState.kind === 'editing' && next.kind !== 'idle' && next.id !== tbState.id) {
                    setLayers(prev => {
                      const prevId = tbState.id;
                      return prev.filter(l => l.tool !== 'text' || l.id !== prevId || (l as TextLayer).text.trim() !== '');
                    });
                  }

                  setTbStateWithLog(next, 'handleTap:textbox');
                  if (next.kind !== 'idle') {
                    centerViewOn(tb.x + tb.width / 2, tb.y + tbH / 2);
                    setContextPanel('text');
                  }
                };

                return (
                  <Group key={tb.id} id={tb.id} x={tb.x} y={tb.y}>
                    {tb.background !== '' && (
                      <Rect x={0} y={0} width={tb.width} height={tbH} fill={tb.background} opacity={tb.opacity} />
                    )}

                    <Text x={0} y={0} width={tb.width}
                      ref={node => { if (node) textNodesRef.current.set(tb.id, node); else textNodesRef.current.delete(tb.id); }}
                      text={isEditing ? '' : tb.text}
                      fontSize={tb.fontSize} fontFamily={tb.fontFamily} fontStyle={tb.fontStyle}
                      textDecoration={tb.textDecoration} align={tb.align} verticalAlign={tb.verticalAlign}
                      fill={tb.color} opacity={tb.opacity} padding={tb.padding}
                      wrap="word"
                      listening={false}
                    />

                    {/* Zone intérieure principale — tap / double-tap */}
                    <Rect x={0} y={0} width={tb.width} height={tbH}
                      fill="rgba(0,0,0,0)"
                      onClick={handleTap}
                      onTap={handleTap}
                    />

                    {/* Bordure select mode (canvas selection) */}
                    {isSelected && !isTextSelected && !isEditing && (
                      <Rect x={-2} y={-2} width={tb.width + 4} height={tbH + 4}
                        stroke={isFocused ? '#e63946' : '#118ab2'}
                        strokeWidth={1.5}
                        dash={[5, 3]}
                        fill="transparent"
                        cornerRadius={3}
                        listening={false}
                      />
                    )}

                    {/* Bordure sélection text tool (pas en édition — la textarea a son propre border) */}
                    {isTextSelected && !isEditing && (
                      <Rect x={0} y={0} width={tb.width} height={tbH}
                        stroke="#118ab2"
                        strokeWidth={1.5}
                        fill="transparent"
                        dash={[5, 3]}
                        listening={false}
                      />
                    )}

                    {/* Bords draggables pour déplacer (seulement si sélectionnée) */}
                    {isTextSelected && !isEditing && <>
                      <Rect x={HANDLE_W} y={-BORDER_HIT / 2} width={tb.width - HANDLE_W * 2} height={BORDER_HIT}
                        fill="transparent" draggable
                        onDragMove={e => {
                          const stage = stageRef.current!;
                          const sc = stage.scaleX(), sp = stage.position();
                          const abs = e.target.absolutePosition();
                          setLayers(prev => prev.map(l => l.id !== tb.id || l.tool !== 'text' ? l : {
                            ...l, x: (abs.x - sp.x) / sc - HANDLE_W, y: (abs.y - sp.y) / sc + BORDER_HIT / 2,
                          }));
                        }}
                        onDragEnd={() => scheduleSave()} dragBoundFunc={p => p}
                      />
                      <Rect x={HANDLE_W} y={tbH - BORDER_HIT / 2} width={tb.width - HANDLE_W * 2} height={BORDER_HIT}
                        fill="transparent" draggable
                        onDragMove={e => {
                          const stage = stageRef.current!;
                          const sc = stage.scaleX(), sp = stage.position();
                          const abs = e.target.absolutePosition();
                          setLayers(prev => prev.map(l => l.id !== tb.id || l.tool !== 'text' ? l : {
                            ...l, x: (abs.x - sp.x) / sc - HANDLE_W, y: (abs.y - sp.y) / sc - tbH + BORDER_HIT / 2,
                          }));
                        }}
                        onDragEnd={() => scheduleSave()} dragBoundFunc={p => p}
                      />
                      <Rect x={-BORDER_HIT / 2} y={HANDLE_H} width={BORDER_HIT} height={tbH - HANDLE_H * 2}
                        fill="transparent" draggable
                        onDragMove={e => {
                          const stage = stageRef.current!;
                          const sc = stage.scaleX(), sp = stage.position();
                          const abs = e.target.absolutePosition();
                          setLayers(prev => prev.map(l => l.id !== tb.id || l.tool !== 'text' ? l : {
                            ...l, x: (abs.x - sp.x) / sc + BORDER_HIT / 2, y: (abs.y - sp.y) / sc - HANDLE_H,
                          }));
                        }}
                        onDragEnd={() => scheduleSave()} dragBoundFunc={p => p}
                      />
                      <Rect x={tb.width - BORDER_HIT / 2} y={HANDLE_H} width={BORDER_HIT} height={tbH - HANDLE_H * 2}
                        fill="transparent" draggable
                        onDragMove={e => {
                          const stage = stageRef.current!;
                          const sc = stage.scaleX(), sp = stage.position();
                          const abs = e.target.absolutePosition();
                          setLayers(prev => prev.map(l => l.id !== tb.id || l.tool !== 'text' ? l : {
                            ...l, x: (abs.x - sp.x) / sc - tb.width + BORDER_HIT / 2, y: (abs.y - sp.y) / sc - HANDLE_H,
                          }));
                        }}
                        onDragEnd={() => scheduleSave()} dragBoundFunc={p => p}
                      />
                    </>}

                    {/* Handles resize milieu gauche et droit */}
                    {isTextSelected && !isEditing && <>
                      <ResizeHandle
                        cx={0} cy={tbH / 2} side="left"
                        tb={{ x: tb.x, y: tb.y, width: tb.width }}
                        stageRef={stageRef}
                        onDragEnd={() => scheduleSave()}
                        onMove={(newX, newWidth) => setLayers(prev => prev.map(l =>
                          l.id !== tb.id || l.tool !== 'text' ? l : { ...l, x: newX, width: newWidth },
                        ))}
                      />
                      <ResizeHandle
                        cx={tb.width} cy={tbH / 2} side="right"
                        tb={{ x: tb.x, y: tb.y, width: tb.width }}
                        stageRef={stageRef}
                        onDragEnd={() => scheduleSave()}
                        onMove={(_, newWidth) => setLayers(prev => prev.map(l =>
                          l.id !== tb.id || l.tool !== 'text' ? l : { ...l, width: newWidth },
                        ))}
                      />
                    </>}
                  </Group>
                );
              }

              if (layer.tool === 'airbrush') {
                const ab = layer as AirbrushStroke;
                const xs = ab.points.map(p => p.x), ys = ab.points.map(p => p.y);
                const minX = Math.min(...xs) - ab.radius, minY = Math.min(...ys) - ab.radius;
                const abW = Math.max(...xs) + ab.radius - minX;
                const abH = Math.max(...ys) + ab.radius - minY;
                return (
                  <Group key={ab.id} id={ab.id} onClick={selectItem} onTap={selectItem}>
                    {/* Outline de sélection — cercles plus larges en dessous */}
                    {isSelected && (
                      <AirbrushOutline stroke={ab} color={isFocused ? '#e63946' : '#118ab2'} />
                    )}
                    <AirbrushShape stroke={ab} />
                    {/* Zone de hit transparente — AirbrushShape a listening={false} */}
                    <Rect x={minX} y={minY} width={abW} height={abH} fill="rgba(0,0,0,0)" />
                  </Group>
                );
              } else {
                const s = layer as Stroke;
                return (
                  <Group key={s.id} id={s.id} onClick={selectItem} onTap={selectItem}>
                    {/* Outline de sélection — même tracé, plus épais, en dessous */}
                    {isSelected && (
                      <Line points={s.points}
                        stroke={isFocused ? '#e63946' : '#118ab2'}
                        strokeWidth={s.width + 6}
                        lineCap="round" lineJoin="round" tension={0.3}
                        opacity={0.55}
                        listening={false}
                      />
                    )}
                    <Line points={s.points}
                      stroke={s.color}
                      strokeWidth={s.width} opacity={s.opacity}
                      lineCap="round" lineJoin="round" tension={0.3}
                      hitStrokeWidth={Math.max(s.width, 20)}
                    />
                  </Group>
                );
              }
            })}

            {/* Tracé en cours */}
            {currentStroke && <Line points={currentStroke.points} stroke={currentStroke.color} strokeWidth={currentStroke.width} opacity={currentStroke.opacity} lineCap="round" lineJoin="round" tension={0.3} />}
            {currentAirbrush && <AirbrushShape stroke={currentAirbrush} />}


            {selRect && selRect.w > 0 && <Rect x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h} stroke="#118ab2" strokeWidth={1} dash={[6, 3]} fill="rgba(17,138,178,0.06)" />}
          </Layer>
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
      {editingTextId && editingTextBox && stageRef.current && (() => {
        const stage = stageRef.current!;
        const sc = stage.scaleX();
        const sp = stage.position();
        // Coordonnées écran : décalage du canvas div (top = TOPBAR_H + DRAWINGBAR_H) + position Konva
        const screenLeft = editingTextBox.x * sc + sp.x;
        const screenTop = TOPBAR_H + DRAWINGBAR_H + editingTextBox.y * sc + sp.y;
        const autoResizeTextarea = (el: HTMLTextAreaElement) => {
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        };
        return (
          <textarea
            ref={el => {
              textareaRef.current = el;
              if (el) autoResizeTextarea(el);
            }}
            autoFocus
            value={editingTextBox.text}
            onChange={e => {
              updateTextBox({ text: e.target.value });
              autoResizeTextarea(e.target);
            }}
            onKeyDown={e => { if (e.key === 'Escape') exitEditing(); }}
            onBlur={e => {
              const related = e.relatedTarget as HTMLElement | null;
              // Ne pas sortir si le focus part vers les barres (topbar, drawingbar, contextToolbar, textPanel)
              // ou vers les FABs
              if (related && (
                related.closest('[data-text-panel]') ||
                related.closest('[data-bars]') ||
                related.closest('[data-fabs]')
              )) return;
              exitEditing();
            }}
            style={{
              position: 'fixed',
              left: screenLeft,
              top: screenTop,
              width: editingTextBox.width * sc,
              minWidth: 80 * sc,
              minHeight: 40,
              height: 'auto',
              fontSize: editingTextBox.fontSize * sc,
              fontFamily: editingTextBox.fontFamily,
              fontWeight: editingTextBox.fontStyle.includes('bold') ? 'bold' : 'normal',
              fontStyle: editingTextBox.fontStyle.includes('italic') ? 'italic' : 'normal',
              textDecoration: editingTextBox.textDecoration,
              textAlign: editingTextBox.align,
              color: editingTextBox.color,
              background: 'transparent',
              opacity: editingTextBox.opacity,
              padding: editingTextBox.padding,
              border: '2px solid #e63946',
              borderRadius: 4, resize: 'none', outline: 'none',
              zIndex: 200, lineHeight: 1.4, boxSizing: 'border-box',
              caretColor: editingTextBox.color,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowY: 'hidden',
            }}
          />
        );
      })()}

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
