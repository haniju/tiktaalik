import React, { useRef, useState, useCallback } from 'react';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { DrawLayer, Stroke, AirbrushStroke, TextLayer, ToolState } from '../types';
import { AIRBRUSH_CONFIG } from '../utils/airbrushConfig';
import {
  TextBoxSelectionState,
  nextSelectionState,
  estimateTextHeight,
  findTextBoxAtPoint,
  isRectIntersecting,
} from '../utils/textboxUtils';
import type { ContextPanel } from './useToolState';

export interface UseCanvasGesturesParams {
  stageRef: React.RefObject<Konva.Stage>;
  layersRef: React.MutableRefObject<DrawLayer[]>;
  toolStateRef: React.MutableRefObject<ToolState>;
  tbStateRef: React.MutableRefObject<TextBoxSelectionState>;
  editingTextIdRef: React.MutableRefObject<string | null>;
  editingCreatedAtRef: React.MutableRefObject<number>;
  selectionRef: React.MutableRefObject<string[]>;
  setTbStateWithLogRef: React.MutableRefObject<(next: TextBoxSelectionState, source: string) => void>;
  centerViewOnRef: React.MutableRefObject<(cx: number, cy: number, immediate?: boolean, topOffsetPx?: number) => void>;
  barsRef: React.RefObject<HTMLDivElement>;
  setLayers: React.Dispatch<React.SetStateAction<DrawLayer[]>>;
  setSelection: React.Dispatch<React.SetStateAction<string[]>>;
  setContextPanel: React.Dispatch<React.SetStateAction<ContextPanel>>;
  setZoomPct: React.Dispatch<React.SetStateAction<number>>;
  exitEditing: () => void;
  collapseEditingToSelected: () => void;
  addTextBox: (x: number, y: number) => void;
  collapsePanel: () => void;
  pushUndo: (layers: DrawLayer[]) => void;
  scheduleSave: () => void;
  activeColor: string;
  activeWidth: number;
}

export interface UseCanvasGesturesReturn {
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseUp: () => void;
  handleWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void;
  handleTapById: (tbId: string, tbH: number, e: Konva.KonvaEventObject<Event>) => void;
  handleDragEnd: () => void;
  handleSelectItem: (id: string) => void;
  selRect: { x: number; y: number; w: number; h: number } | null;
  currentStroke: Stroke | null;
  currentAirbrush: AirbrushStroke | null;
  textNodesRef: React.MutableRefObject<Map<string, Konva.Text>>;
}

export function useCanvasGestures(params: UseCanvasGesturesParams): UseCanvasGesturesReturn {
  // Paramètres stables via ref — tous les handlers sont [] stables (pas de stale closures)
  const p = useRef(params);
  p.current = params;

  // ─── État rendu — exposé pour DrawingLayer ─────────────────────────────────
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [currentAirbrush, setCurrentAirbrush] = useState<AirbrushStroke | null>(null);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Refs miroir pour lecture synchrone dans les handlers (évite closure sur state périmé)
  const currentStrokeRef = useRef<Stroke | null>(null);
  currentStrokeRef.current = currentStroke;
  const currentAirbrushRef = useRef<AirbrushStroke | null>(null);
  currentAirbrushRef.current = currentAirbrush;
  const selRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  selRectRef.current = selRect;

  // ─── Refs gesture — tous internes ──────────────────────────────────────────
  const selRectStart = useRef<{ x: number; y: number } | null>(null);
  const isDraggingSelection = useRef(false);
  const dragArmed = useRef(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragPointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragLayerSnapshot = useRef<DrawLayer[]>([]);
  const dragSelectionRef = useRef<string[]>([]);
  const dragLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDrawing = useRef(false);
  const isErasing = useRef(false);
  const lastAirbrushPt = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  const pendingTextboxRef = useRef<{ x: number; y: number } | null>(null);
  // Guard : empêche le tap Konva (synthétique post-touchend) de déclencher une transition après un drag
  const dragJustEndedRef = useRef(false);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  // Refs vers les nœuds Text Konva — lecture directe des dimensions au render
  const textNodesRef = useRef<Map<string, Konva.Text>>(new Map());

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const eraseAt = useCallback((pos: { x: number; y: number }) => {
    p.current.setLayers(prev => prev.filter(layer => {
      if (layer.tool === 'text') return true; // les textboxes ne s'effacent pas à la gomme
      if (layer.tool === 'airbrush') {
        return !layer.points.some(pt => Math.hypot(pt.x - pos.x, pt.y - pos.y) < layer.radius * 0.8);
      } else {
        const pts = (layer as Stroke).points;
        for (let i = 0; i < pts.length - 2; i += 2) {
          if (Math.hypot(pts[i] - pos.x, pts[i + 1] - pos.y) < 20) return false;
        }
        return true;
      }
    }));
  }, []);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const { stageRef, toolStateRef, editingTextIdRef, tbStateRef, selectionRef,
            setSelection, setContextPanel, setTbStateWithLogRef,
            exitEditing, collapseEditingToSelected, collapsePanel,
            activeColor, activeWidth } = p.current;
    const stage = stageRef.current!;
    const toolState = toolStateRef.current;

    const pos = stage.getRelativePointerPosition()!;
    const screenPos = stage.getPointerPosition()!;

    // En mode text : si on édite et qu'on tape sur le canvas → collapse vers selected
    if (editingTextIdRef.current && toolState.activeTool === 'text') {
      collapseEditingToSelected();
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
        dragLayerSnapshot.current = p.current.layersRef.current.map(l => ({ ...l }));
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
          dragLayerSnapshot.current = p.current.layersRef.current.map(l => ({ ...l }));
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
          dragLayerSnapshot.current = p.current.layersRef.current.map(l => ({ ...l }));
          dragSelectionRef.current = [hitId];
          return;
        }
        // Tap sur une autre textbox ou sur le fond → désélectionner (pas de création)
        exitEditing();
        if (hitId) {
          // Tap sur une autre textbox → la sélectionner
          setTbStateWithLogRef.current({ kind: 'selected', id: hitId }, 'handleMouseDown:otherTextbox');
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
      // Mise à jour directe du ref : handleMouseUp peut arriver avant le re-render (tap court)
      currentAirbrushRef.current = ab;
      setCurrentAirbrush(ab);
      lastAirbrushPt.current = pos;
      isDrawing.current = true;
      return;
    }

    if (toolState.activeTool === 'pen' || toolState.activeTool === 'marker') {
      if (editingTextIdRef.current) exitEditing();
      const opacity = toolState.toolOpacities[toolState.activeTool];
      const w = toolState.activeTool === 'marker' ? activeWidth * 4 : activeWidth;
      const stroke: Stroke = { id: uuidv4(), tool: toolState.activeTool, color: activeColor, width: w, opacity, points: [pos.x, pos.y, pos.x, pos.y] };
      // Mise à jour directe du ref : handleMouseUp peut arriver avant le re-render (tap court)
      currentStrokeRef.current = stroke;
      setCurrentStroke(stroke);
      isDrawing.current = true;
    }
  }, [eraseAt]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const { stageRef, editingTextIdRef, toolStateRef, setZoomPct, setLayers, selectionRef } = p.current;
    const stage = stageRef.current!;
    const toolState = toolStateRef.current;

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
          return { ...ab, points: ab.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) };
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

    if (toolState.activeTool === 'airbrush' && isDrawing.current && currentAirbrushRef.current) {
      const last = lastAirbrushPt.current;
      const currentAB = currentAirbrushRef.current;
      if (last) {
        const dx = pos.x - last.x, dy = pos.y - last.y;
        const dist = Math.hypot(dx, dy);
        const step = currentAB.radius * (1 - AIRBRUSH_CONFIG.pointDensity + 0.1);
        const steps = Math.max(1, Math.floor(dist / step));
        const newPts: Array<{ x: number; y: number }> = [];
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const pt = { x: last.x + dx * t, y: last.y + dy * t };
          newPts.push(pt);
        }
        setCurrentAirbrush(prev => prev ? { ...prev, points: [...prev.points, ...newPts] } : null);
      }
      lastAirbrushPt.current = pos;
      return;
    }

    if (isDrawing.current && currentStrokeRef.current) {
      setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pos.x, pos.y] } : null);
    }
  }, [eraseAt]);

  const handleMouseUp = useCallback(() => {
    const { stageRef, tbStateRef, editingTextIdRef, editingCreatedAtRef,
            toolStateRef, layersRef, setLayers, setSelection, setContextPanel,
            setTbStateWithLogRef, centerViewOnRef, addTextBox, pushUndo, scheduleSave } = p.current;
    const toolState = toolStateRef.current;

    // Créer la textbox si c'était un vrai tap.
    // Guard : vérifier qu'on ne tape pas sur une textbox existante (race condition touch :
    // handleMouseUp se déclenche AVANT handleTap sur mobile)
    if (pendingTextboxRef.current) {
      const { x, y } = pendingTextboxRef.current;
      pendingTextboxRef.current = null;
      const textLayers = layersRef.current.filter((l): l is TextLayer => l.tool === 'text');
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
        setTbStateWithLogRef.current(next, 'handleMouseUp:tap');
        if (next.kind !== 'idle') {
          const tbH = heights.get(hitTb.id) ?? estimateTextHeight(hitTb);
          const barsH = p.current.barsRef.current?.offsetHeight ?? 0;
          const stage = stageRef.current;
          if (stage) {
            const sc = stage.scaleX();
            stage.position({ x: 20 - hitTb.x * sc, y: barsH + 20 - hitTb.y * sc });
            stage.batchDraw();
          }
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
      dragJustEndedRef.current = true; // bloque le tap Konva synthétique post-drag
      pushUndo(layersRef.current);
      scheduleSave();
      return;
    }

    const currentSelRect = selRectRef.current;
    if (toolState.canvasMode === 'select' && selRectStart.current && currentSelRect) {
      if (currentSelRect.w > 5 && currentSelRect.h > 5) {
        const layers = layersRef.current;
        const selIds = layers.filter(layer => {
          if (layer.tool === 'text') return false; // géré par selT ci-dessous
          if (layer.tool === 'airbrush') {
            return layer.points.some(pt => pt.x >= currentSelRect.x && pt.x <= currentSelRect.x + currentSelRect.w && pt.y >= currentSelRect.y && pt.y <= currentSelRect.y + currentSelRect.h);
          } else {
            const pts = (layer as Stroke).points;
            return pts.some((_, i) => i % 2 === 0 && pts[i] >= currentSelRect.x && pts[i] <= currentSelRect.x + currentSelRect.w && pts[i + 1] >= currentSelRect.y && pts[i + 1] <= currentSelRect.y + currentSelRect.h);
          }
        }).map(l => l.id);
        const selT = layers
          .filter((l): l is TextLayer => l.tool === 'text')
          .filter(tb => {
            const h = textNodesRef.current.get(tb.id)?.height() ?? estimateTextHeight(tb);
            return isRectIntersecting(
              { x: tb.x, y: tb.y, w: tb.width, h },
              { x: currentSelRect.x, y: currentSelRect.y, w: currentSelRect.w, h: currentSelRect.h },
            );
          })
          .map(tb => tb.id);
        setSelection([...selIds, ...selT]);
      }
      selRectStart.current = null; setSelRect(null);
      return;
    }

    if (toolState.activeTool === 'airbrush' && isDrawing.current && currentAirbrushRef.current) {
      isDrawing.current = false; lastAirbrushPt.current = null;
      const ca = currentAirbrushRef.current;
      const newL = [...layersRef.current, ca];
      setLayers(newL); pushUndo(newL);
      setCurrentAirbrush(null); scheduleSave();
      return;
    }

    if (currentStrokeRef.current && isDrawing.current) {
      isDrawing.current = false;
      const cs = currentStrokeRef.current;
      const newL = [...layersRef.current, cs];
      setLayers(newL); pushUndo(newL);
      setCurrentStroke(null); scheduleSave();
    }
  }, []);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = p.current.stageRef.current!;
    const os = stage.scaleX();
    const pt = stage.getPointerPosition()!;
    const mpt = { x: (pt.x - stage.x()) / os, y: (pt.y - stage.y()) / os };
    const ns = Math.max(0.2, Math.min(40, os * (1 + (e.evt.deltaY > 0 ? -1 : 1) * 0.1)));
    stage.scale({ x: ns, y: ns });
    stage.position({ x: pt.x - mpt.x * ns, y: pt.y - mpt.y * ns });
    stage.batchDraw();
    p.current.setZoomPct(Math.round(ns * 100));
  }, []);

  const handleTapById = useCallback((tbId: string, tbH: number, e: Konva.KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    pendingTextboxRef.current = null;
    if (dragJustEndedRef.current) { dragJustEndedRef.current = false; return; }
    const { toolStateRef, layersRef, tbStateRef, editingCreatedAtRef, stageRef,
            setLayers, setSelection, setContextPanel, setTbStateWithLogRef, centerViewOnRef } = p.current;
    const ts = toolStateRef.current;
    if (ts.canvasMode === 'select') {
      setSelection(prev => prev.includes(tbId) ? prev : [...prev, tbId]);
      return;
    }
    if (ts.activeTool !== 'text') return;
    const now = Date.now();
    const elapsed = lastTapRef.current?.id === tbId ? now - lastTapRef.current.time : Infinity;
    if (elapsed < 80) return;
    lastTapRef.current = { id: tbId, time: now };
    const isDoubleTap = elapsed < 300;

    const textLayers = layersRef.current.filter((l): l is TextLayer => l.tool === 'text');
    const heights = new Map(
      textLayers.map(t => [
        t.id,
        textNodesRef.current.get(t.id)
          ? Math.max(textNodesRef.current.get(t.id)!.height(), 20)
          : estimateTextHeight(t),
      ])
    );

    const stage = stageRef.current!;
    const pos = stage.getRelativePointerPosition()!;
    let next = nextSelectionState(tbStateRef.current, pos.x, pos.y, textLayers, heights);

    if (isDoubleTap && next.kind === 'selected') {
      next = { kind: 'editing', id: next.id };
    }

    if (next.kind === 'editing' && tbStateRef.current.kind !== 'editing') {
      editingCreatedAtRef.current = Date.now();
    }
    if (tbStateRef.current.kind === 'editing' && next.kind !== 'idle' && next.id !== tbStateRef.current.id) {
      const prevId = tbStateRef.current.id;
      setLayers(prev => prev.filter(l => l.tool !== 'text' || l.id !== prevId || (l as TextLayer).text.trim() !== ''));
    }

    setTbStateWithLogRef.current(next, 'handleTapById');
    if (next.kind !== 'idle') {
      const tb = textLayers.find(t => t.id === tbId);
      if (tb) {
        const barsH = p.current.barsRef.current?.offsetHeight ?? 0;
        const s = stageRef.current;
        if (s) {
          const sc = s.scaleX();
          s.position({ x: 20 - tb.x * sc, y: barsH + 20 - tb.y * sc });
          s.batchDraw();
        }
      }
      setContextPanel('text');
    }
  }, []);

  const handleDragEnd = useCallback(() => p.current.scheduleSave(), []);

  const handleSelectItem = useCallback((id: string) => {
    p.current.setSelection(prev => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTapById,
    handleDragEnd,
    handleSelectItem,
    selRect,
    currentStroke,
    currentAirbrush,
    textNodesRef,
  };
}
