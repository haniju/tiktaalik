import React, { useRef, useState, useCallback } from 'react';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
import { DrawLayer, Stroke, AirbrushStroke, TextLayer, ToolState } from '../types';
import { AIRBRUSH_CONFIG } from '../utils/airbrushConfig';
import { clampStagePos } from './useStageViewport';
import {
  TextBoxSelectionState,
  nextSelectionState,
  estimateTextHeight,
  findTextBoxAtPoint,
  isRectIntersecting,
  roundTextBoxFontSize,
} from '../utils/textboxUtils';
import { getLayerBounds, getGroupBounds, applyScale, applyRotation } from '../utils/bounds';
import type { ContextPanel } from './useToolState';

export interface UseCanvasGesturesParams {
  stageRef: React.RefObject<Konva.Stage>;
  layersRef: React.MutableRefObject<DrawLayer[]>;
  toolStateRef: React.MutableRefObject<ToolState>;
  tbStateRef: React.MutableRefObject<TextBoxSelectionState>;
  editingTextIdRef: React.MutableRefObject<string | null>;
  editingCreatedAtRef: React.MutableRefObject<number>;
  selectionRef: React.MutableRefObject<string[]>;
  focusedIdsRef: React.MutableRefObject<string[]>;
  setTbStateWithLogRef: React.MutableRefObject<(next: TextBoxSelectionState, source: string) => void>;
  centerViewOnRef: React.MutableRefObject<(cx: number, cy: number, immediate?: boolean, topOffsetPx?: number) => void>;
  barsRef: React.RefObject<HTMLDivElement>;
  setLayers: React.Dispatch<React.SetStateAction<DrawLayer[]>>;
  setSelection: React.Dispatch<React.SetStateAction<string[]>>;
  setFocusedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setContextPanel: React.Dispatch<React.SetStateAction<ContextPanel>>;
  setZoomPct: React.Dispatch<React.SetStateAction<number>>;
  exitEditing: () => void;
  collapseEditingToSelected: () => void;
  addTextBox: (x: number, y: number) => void;
  collapsePanel: () => void;
  pushUndo: (layers: DrawLayer[]) => void;
  scheduleSave: () => void;
  pinchZoomEnabledRef: React.MutableRefObject<boolean>;
  holdPanActiveRef: React.MutableRefObject<boolean>;
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
  handleScaleStart: () => void;
  handleScaleMove: (scaleFactor: number) => void;
  handleScaleEnd: () => void;
  handleRotateStart: () => void;
  handleRotateMove: (angleDeg: number) => void;
  handleRotateEnd: () => void;
  selRect: { x: number; y: number; w: number; h: number } | null;
  currentStroke: Stroke | null;
  currentAirbrush: AirbrushStroke | null;
  liveLineRef: React.MutableRefObject<Konva.Line | null>;
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
  const dragArmedHitId = useRef<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragPointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragLayerSnapshot = useRef<DrawLayer[]>([]);
  const dragSelectionRef = useRef<string[]>([]);
  const dragLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressCanvasPos = useRef<{ x: number; y: number } | null>(null); // position canvas au mouseDown (pour lasso différé)
  const isDrawing = useRef(false);
  const isErasing = useRef(false);
  const lastAirbrushPt = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  // Hold-to-pan : identifier du touch du doigt B sur le canvas (pour bypasser Konva getPointerPosition)
  const holdPanTouchId = useRef<number | null>(null);
  const pendingTextboxRef = useRef<{ x: number; y: number } | null>(null);
  // Guard : empêche le tap Konva (synthétique post-touchend) de déclencher une transition après un drag
  const dragJustEndedRef = useRef(false);
  // Guard : empêche handleTapById de double-fire après que handleMouseUp a déjà consommé le tap
  const mouseUpHandledTapRef = useRef(false);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  // Pinch zoom
  const isPinching = useRef(false);
  const lastPinchDist = useRef(0);
  const pinchCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Refs vers les nœuds Text Konva — lecture directe des dimensions au render
  const textNodesRef = useRef<Map<string, Konva.Text>>(new Map());
  // Scale — snapshot pattern (même approche que drag-to-move)
  const scaleSnapshotRef = useRef<DrawLayer[]>([]);
  const scaleCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Rotate — snapshot pattern
  const rotateSnapshotRef = useRef<DrawLayer[]>([]);
  const rotateCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotateLatestRef = useRef<DrawLayer[]>([]); // résultat synchrone du dernier handleRotateMove
  // Bypass React — tracé pen/marker directement via l'API impérative Konva
  const liveLineRef = useRef<Konva.Line | null>(null);
  const livePointsRef = useRef<number[]>([]);
  // Smoothing — filtre de distance minimale pour pen/marker
  const lastAcceptedPt = useRef<{ x: number; y: number } | null>(null);
  const lastRawPt = useRef<{ x: number; y: number } | null>(null);
  // Mount guard — bloque les événements fantômes (synthetic mouse events post-touch sur la vignette HomeScreen)
  const mountReadyRef = useRef(false);
  React.useEffect(() => {
    const timer = setTimeout(() => { mountReadyRef.current = true; }, 300);
    return () => { clearTimeout(timer); mountReadyRef.current = false; };
  }, []);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Cherche un touch par identifier dans evt.touches et retourne sa position relative au stage container.
   *  Retourne null si le touch n'est plus actif (doigt levé). */
  const getTouchScreenPos = useCallback((nativeEvt: TouchEvent, touchId: number, stage: Konva.Stage): { x: number; y: number } | null => {
    for (let i = 0; i < nativeEvt.touches.length; i++) {
      if (nativeEvt.touches[i].identifier === touchId) {
        const stageBox = stage.container().getBoundingClientRect();
        return { x: nativeEvt.touches[i].clientX - stageBox.left, y: nativeEvt.touches[i].clientY - stageBox.top };
      }
    }
    return null;
  }, []);

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
    // Guard : ignore les événements fantômes pendant les 300ms après le mount
    if (!mountReadyRef.current) return;
    const { stageRef, toolStateRef, editingTextIdRef, tbStateRef, selectionRef,
            setSelection, setContextPanel, setTbStateWithLogRef,
            exitEditing, collapseEditingToSelected, collapsePanel,
            pinchZoomEnabledRef,
            activeColor, activeWidth } = p.current;
    const stage = stageRef.current!;
    const toolState = toolStateRef.current;

    // Pinch zoom — détection de deux doigts
    // Guard : si holdPan est actif, les 2 touches = doigt A sur FAB + doigt B sur canvas, pas un vrai pinch
    const nativeEvt = e.evt;
    if (pinchZoomEnabledRef.current && !p.current.holdPanActiveRef.current && 'touches' in nativeEvt && nativeEvt.touches.length >= 2) {
      e.evt.preventDefault();
      const t1 = nativeEvt.touches[0], t2 = nativeEvt.touches[1];
      lastPinchDist.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const stageBox = stage.container().getBoundingClientRect();
      pinchCenter.current = {
        x: (t1.clientX + t2.clientX) / 2 - stageBox.left,
        y: (t1.clientY + t2.clientY) / 2 - stageBox.top,
      };
      isPinching.current = true;
      // Annuler tout geste en cours
      isDrawing.current = false;
      isErasing.current = false;
      isPanning.current = false;
      return;
    }

    const pos = stage.getRelativePointerPosition()!;
    const screenPos = stage.getPointerPosition()!;

    // En mode text : si on édite et qu'on tape sur le canvas → collapse vers selected
    // SAUF si le tap est sur le TB en cours d'édition (zone Konva rotée qui dépasse la textarea)
    if (editingTextIdRef.current && toolState.activeTool === 'text') {
      let node: Konva.Node | null = e.target;
      let hitId: string | null = null;
      while (node) {
        const nid = node.id?.();
        if (nid) { hitId = nid; break; }
        node = node.getParent?.() ?? null;
      }
      if (hitId === editingTextIdRef.current) return; // tap sur le TB en édition → ignorer
      collapseEditingToSelected();
      return;
    }

    // Bloquer tout le reste si on édite (sauf text tool géré ci-dessus)
    if (editingTextIdRef.current) return;

    // Clic sur le fond (stage OU Rect A4) → sortir de l'édition texte (sécurité)
    const targetName = (e.target as Konva.Node).name();
    const isBackground = e.target === stage || targetName === 'background-rect';

    if (toolState.canvasMode === 'move' || p.current.holdPanActiveRef.current) {
      // En hold-to-pan multi-touch, Konva getPointerPosition() lit touches[0] = doigt A (FAB, immobile).
      // On tracke le touch identifier du doigt B pour lire sa position directement dans evt.touches.
      let panScreenPos = screenPos;
      if (p.current.holdPanActiveRef.current && 'changedTouches' in nativeEvt && nativeEvt.changedTouches.length > 0) {
        const ct = nativeEvt.changedTouches[0];
        holdPanTouchId.current = ct.identifier;
        const stageBox = stage.container().getBoundingClientRect();
        panScreenPos = { x: ct.clientX - stageBox.left, y: ct.clientY - stageBox.top };
      } else {
        holdPanTouchId.current = null;
      }
      isPanning.current = true;
      panStart.current = { x: panScreenPos.x, y: panScreenPos.y, sx: stage.x(), sy: stage.y() };
      return;
    }

    if (toolState.canvasMode === 'select') {
      if (isBackground) {
        setSelection([]);
        p.current.setFocusedIds([]);
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
        dragArmedHitId.current = hitId;
        dragStartPos.current = snapPos;
        dragPointerStart.current = snapScreen;
        dragLayerSnapshot.current = p.current.layersRef.current.map(l => ({ ...l }));
      } else {
        // Long-press (350ms) pour les objets non sélectionnés
        dragPointerStart.current = snapScreen;
        longPressCanvasPos.current = snapPos;
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
          dragArmedHitId.current = hitId;
          dragStartPos.current = pos;
          dragPointerStart.current = screenPos;
          dragLayerSnapshot.current = p.current.layersRef.current.map(l => ({ ...l }));
          dragSelectionRef.current = [hitId];
          return;
        }
        // Tap sur une autre textbox ou sur le fond → désélectionner (pas de création)
        exitEditing();
        if (hitId) {
          // Tap sur une autre textbox → la sélectionner + recentrer le viewport
          setTbStateWithLogRef.current({ kind: 'selected', id: hitId }, 'handleMouseDown:otherTextbox');
          setContextPanel('text');
          const textLayers = p.current.layersRef.current.filter((l): l is TextLayer => l.tool === 'text');
          const hitTb = textLayers.find(t => t.id === hitId);
          if (hitTb) {
            const barsH = p.current.barsRef.current?.offsetHeight ?? 0;
            const sc = stage.scaleX();
            const aabb = getLayerBounds(hitTb);
            stage.position(clampStagePos({ x: 20 - aabb.x * sc, y: barsH + 20 - aabb.y * sc }, sc, stage.width(), stage.height()));
            stage.batchDraw();
          }
          // Guard : empêcher handleTapById de re-traiter ce même tap (sinon selected→editing)
          mouseUpHandledTapRef.current = true;
        }
        return;
      }
      // État idle → mémoriser la position pour création au touchend (guard pinch)
      pendingTextboxRef.current = { x: pos.x, y: pos.y };
      return;
    }

    if (toolState.activeTool === 'airbrush') {
      const radius = activeWidth * AIRBRUSH_CONFIG.radiusMultiplier;
      const ab: AirbrushStroke = { id: uuidv4(), tool: 'airbrush', color: activeColor, radius, centerOpacity: toolState.toolOpacities.airbrush, edgeOpacity: toolState.airbrushEdgeOpacity, points: [{ x: pos.x, y: pos.y }] };
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
      // Micro-offset 0.1px sur le 2e point : Konva <Line tension> ne rend rien pour un segment
      // de longueur zéro (tap court), le décalage force un segment minimal → point rond via lineCap="round"
      const stroke: Stroke = { id: uuidv4(), tool: toolState.activeTool, color: activeColor, width: w, opacity, points: [pos.x, pos.y, pos.x + 0.1, pos.y + 0.1] };
      // Bypass React : on stocke seulement dans le ref miroir (pas de setCurrentStroke ici).
      // setCurrentStroke monte le nœud <Line> vide dans DrawingLayer, puis liveLineRef prend le relais.
      currentStrokeRef.current = stroke;
      setCurrentStroke(stroke);
      livePointsRef.current = [pos.x, pos.y, pos.x + 0.1, pos.y + 0.1];
      lastAcceptedPt.current = { x: pos.x, y: pos.y };
      lastRawPt.current = { x: pos.x, y: pos.y };
      isDrawing.current = true;
    }
  }, [eraseAt]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const { stageRef, editingTextIdRef, toolStateRef, setZoomPct, setLayers, setSelection, selectionRef, pinchZoomEnabledRef } = p.current;
    const stage = stageRef.current!;
    const toolState = toolStateRef.current;

    // Pinch zoom — gestion du mouvement à deux doigts
    const nativeEvt = e.evt;
    if (isPinching.current && pinchZoomEnabledRef.current && 'touches' in nativeEvt && nativeEvt.touches.length >= 2) {
      e.evt.preventDefault();
      const t1 = nativeEvt.touches[0], t2 = nativeEvt.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (lastPinchDist.current > 0) {
        const os = stage.scaleX();
        const ns = Math.max(0.2, Math.min(40, os * (dist / lastPinchDist.current)));
        const center = pinchCenter.current;
        const mpt = { x: (center.x - stage.x()) / os, y: (center.y - stage.y()) / os };
        stage.scale({ x: ns, y: ns });
        stage.position(clampStagePos({ x: center.x - mpt.x * ns, y: center.y - mpt.y * ns }, ns, stage.width(), stage.height()));
        stage.batchDraw();
        setZoomPct(Math.round(ns * 100));
      }
      lastPinchDist.current = dist;
      const stageBox = stage.container().getBoundingClientRect();
      pinchCenter.current = {
        x: (t1.clientX + t2.clientX) / 2 - stageBox.left,
        y: (t1.clientY + t2.clientY) / 2 - stageBox.top,
      };
      return;
    }

    if (editingTextIdRef.current) return;
    const pos = stage.getRelativePointerPosition()!;
    const screenPos = stage.getPointerPosition()!;

    if ((toolState.canvasMode === 'move' || holdPanTouchId.current !== null) && isPanning.current && panStart.current) {
      // Hold-to-pan : chercher le touch tracké par identifier (indépendant de Konva getPointerPosition)
      let panScreenPos = screenPos;
      if (holdPanTouchId.current !== null && 'touches' in nativeEvt) {
        const found = getTouchScreenPos(nativeEvt as TouchEvent, holdPanTouchId.current, stage);
        if (!found) return; // touch plus actif (doigt levé) → ignorer, handleMouseUp nettoiera
        panScreenPos = found;
      }
      const raw = { x: panStart.current.sx + panScreenPos.x - panStart.current.x, y: panStart.current.sy + panScreenPos.y - panStart.current.y };
      stage.position(clampStagePos(raw, stage.scaleX(), stage.width(), stage.height()));
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
    // Annuler le long-press si le doigt a bougé → démarrer le lasso en mode select
    if (dragLongPressTimer.current && dragPointerStart.current) {
      const ddx = screenPos.x - dragPointerStart.current.x;
      const ddy = screenPos.y - dragPointerStart.current.y;
      if (Math.hypot(ddx, ddy) > 8) {
        clearTimeout(dragLongPressTimer.current);
        dragLongPressTimer.current = null;
        dragPointerStart.current = null;
        // En mode select, convertir en lasso depuis la position originale du pointer
        if (toolState.canvasMode === 'select' && longPressCanvasPos.current) {
          const startP = longPressCanvasPos.current;
          setSelection([]);
          p.current.setFocusedIds([]);
          selRectStart.current = startP;
          setSelRect({ x: Math.min(startP.x, pos.x), y: Math.min(startP.y, pos.y), w: Math.abs(pos.x - startP.x), h: Math.abs(pos.y - startP.y) });
        }
        longPressCanvasPos.current = null;
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
        // Densité de pas contrôlée par le lissage : 0% → 0.6 (actuel), 100% → 0.15 (chevauchement dense)
        const abSmoothing = toolState.toolSmoothings.airbrush ?? 0;
        const stepFactor = 0.6 - abSmoothing * 0.45;
        const step = Math.max(currentAB.radius * stepFactor, 1);
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
      // Récupérer les points coalescés (stylet haute fréquence) — fallback sur l'événement natif
      const coalescedEvents = (e.evt as PointerEvent).getCoalescedEvents?.() ?? [e.evt];
      const stage = p.current.stageRef.current!;
      const scale = stage.scaleX();
      const stagePos = stage.position();
      const stageBox = stage.container().getBoundingClientRect();
      const smoothing = toolState.toolSmoothings[toolState.activeTool as 'pen' | 'marker'] ?? 0;
      const minDist = smoothing * 12;
      const minDistSq = minDist * minDist;

      for (const ce of coalescedEvents) {
        // Convertir les coords écran → coords monde pour chaque point coalescé
        const clientX = (ce as PointerEvent).clientX ?? (e.evt as MouseEvent).clientX;
        const clientY = (ce as PointerEvent).clientY ?? (e.evt as MouseEvent).clientY;
        const wx = (clientX - stageBox.left - stagePos.x) / scale;
        const wy = (clientY - stageBox.top - stagePos.y) / scale;

        lastRawPt.current = { x: wx, y: wy };
        // Filtre de distance minimale — élimine le micro-jitter tactile
        if (minDistSq > 0 && lastAcceptedPt.current) {
          const dx = wx - lastAcceptedPt.current.x;
          const dy = wy - lastAcceptedPt.current.y;
          if (dx * dx + dy * dy < minDistSq) continue;
        }
        lastAcceptedPt.current = { x: wx, y: wy };
        livePointsRef.current.push(wx, wy);
      }
      // Mise à jour impérative Konva — zéro re-render React
      if (liveLineRef.current) {
        liveLineRef.current.points(livePointsRef.current);
        liveLineRef.current.getLayer()?.batchDraw();
      }
    }
  }, [eraseAt]);

  const handleMouseUp = useCallback(() => {
    // Reset pinch zoom
    if (isPinching.current) {
      isPinching.current = false;
      lastPinchDist.current = 0;
      return;
    }

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
        // Guard : empêcher handleTapById de re-traiter ce même tap
        mouseUpHandledTapRef.current = true;
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
            const aabb = getLayerBounds(hitTb as TextLayer);
            stage.position({ x: 20 - aabb.x * sc, y: barsH + 20 - aabb.y * sc });
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

    if (isPanning.current) { isPanning.current = false; panStart.current = null; holdPanTouchId.current = null; return; }

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
    longPressCanvasPos.current = null;
    // Sauvegarder la position de départ AVANT nettoyage pour vérifier le déplacement total
    const savedPointerStart = dragPointerStart.current;
    if (dragArmed.current) {
      dragArmed.current = false;
      const hitId = dragArmedHitId.current;
      dragArmedHitId.current = null;
      dragStartPos.current = null;
      dragPointerStart.current = null;
      dragLayerSnapshot.current = [];
      dragSelectionRef.current = [];

      // Mode texte : tap sans drag sur la TB selected → passer en editing
      if (toolState.activeTool === 'text' && hitId && tbStateRef.current.kind === 'selected' && tbStateRef.current.id === hitId) {
        editingCreatedAtRef.current = Date.now();
        setTbStateWithLogRef.current({ kind: 'editing', id: hitId }, 'handleMouseUp:textTap');
        const textLayers = layersRef.current.filter((l): l is TextLayer => l.tool === 'text');
        const tb = textLayers.find(t => t.id === hitId);
        if (tb) {
          const barsH = p.current.barsRef.current?.offsetHeight ?? 0;
          const stage = stageRef.current;
          if (stage) {
            const sc = stage.scaleX();
            stage.position({ x: 20 - tb.x * sc, y: barsH + 20 - tb.y * sc });
            stage.batchDraw();
          }
          setContextPanel('text');
        }
        // Bloquer handleTapById pour éviter double-fire
        mouseUpHandledTapRef.current = true;
      } else {
        // Mode select : tap sans drag → toggle dans le sous-groupe (focusedIds)
        if (hitId) {
          p.current.setFocusedIds(prev => prev.includes(hitId) ? prev.filter(x => x !== hitId) : [...prev, hitId]);
        }
        // Bloquer le click/tap Konva suivant pour éviter double toggle
        dragJustEndedRef.current = true;
      }
    }
    dragPointerStart.current = null;
    if (isDraggingSelection.current) {
      isDraggingSelection.current = false;
      const snapshot = dragLayerSnapshot.current;
      dragStartPos.current = null;
      dragLayerSnapshot.current = [];
      dragSelectionRef.current = [];

      // Vérifier si c'était un vrai drag ou juste du micro-jitter (< 15px)
      const stage = stageRef.current;
      const screenPos = stage?.getPointerPosition();
      const totalDisp = (screenPos && savedPointerStart)
        ? Math.hypot(screenPos.x - savedPointerStart.x, screenPos.y - savedPointerStart.y)
        : Infinity;

      if (totalDisp > 15) {
        // Vrai drag — bloquer le tap Konva synthétique post-drag
        dragJustEndedRef.current = true;
        dragArmedHitId.current = null;
        pushUndo(layersRef.current);
        scheduleSave();
      } else {
        // Micro-jitter → traiter comme un tap : restaurer les positions d'origine
        setLayers(snapshot);
        // Toggle dans le sous-groupe + bloquer le click Konva (peut ne pas fire sur desktop)
        const hitId = dragArmedHitId.current;
        if (hitId) {
          p.current.setFocusedIds(prev => prev.includes(hitId) ? prev.filter(x => x !== hitId) : [...prev, hitId]);
        }
        dragArmedHitId.current = null;
        dragJustEndedRef.current = true;
      }
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
      // Utiliser les points accumulés dans livePointsRef (bypass React)
      let finalPoints = livePointsRef.current;
      // Ajouter le dernier point brut si le filtre de distance l'avait ignoré
      if (lastRawPt.current && lastAcceptedPt.current &&
          (lastRawPt.current.x !== lastAcceptedPt.current.x || lastRawPt.current.y !== lastAcceptedPt.current.y)) {
        finalPoints = [...finalPoints, lastRawPt.current.x, lastRawPt.current.y];
      }
      lastAcceptedPt.current = null;
      lastRawPt.current = null;
      const cs = { ...currentStrokeRef.current, points: finalPoints };
      const newL = [...layersRef.current, cs];
      setLayers(newL); pushUndo(newL);
      setCurrentStroke(null);
      livePointsRef.current = [];
      scheduleSave();
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
    stage.position(clampStagePos({ x: pt.x - mpt.x * ns, y: pt.y - mpt.y * ns }, ns, stage.width(), stage.height()));
    stage.batchDraw();
    p.current.setZoomPct(Math.round(ns * 100));
  }, []);

  const handleTapById = useCallback((tbId: string, tbH: number, e: Konva.KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    pendingTextboxRef.current = null;
    if (dragJustEndedRef.current) { dragJustEndedRef.current = false; return; }
    if (mouseUpHandledTapRef.current) { mouseUpHandledTapRef.current = false; return; }
    const { toolStateRef, layersRef, tbStateRef, editingCreatedAtRef, stageRef,
            setLayers, setSelection, setContextPanel, setTbStateWithLogRef, centerViewOnRef } = p.current;
    const ts = toolStateRef.current;
    if (ts.canvasMode === 'select') {
      const sel = p.current.selectionRef.current;
      if (sel.includes(tbId)) {
        // Déjà sélectionné → toggle dans le sous-groupe (focusedIds)
        p.current.setFocusedIds(prev => prev.includes(tbId) ? prev.filter(x => x !== tbId) : [...prev, tbId]);
      } else {
        setSelection(prev => [...prev, tbId]);
      }
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
          const aabb = getLayerBounds(tb);
          s.position({ x: 20 - aabb.x * sc, y: barsH + 20 - aabb.y * sc });
          s.batchDraw();
        }
      }
      setContextPanel('text');
    }
  }, []);

  const handleDragEnd = useCallback(() => p.current.scheduleSave(), []);

  const handleSelectItem = useCallback((id: string) => {
    if (dragJustEndedRef.current) { dragJustEndedRef.current = false; return; }
    const sel = p.current.selectionRef.current;
    if (sel.includes(id)) {
      // Déjà sélectionné → toggle dans le sous-groupe (focusedIds)
      p.current.setFocusedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      p.current.setSelection(prev => [...prev, id]);
    }
  }, []);

  // ─── Scale handlers (appelés par BoundingBoxHandles via Konva drag) ────────
  const handleScaleStart = useCallback(() => {
    const { layersRef, focusedIdsRef } = p.current;
    scaleSnapshotRef.current = layersRef.current.map(l => ({ ...l }));
    const bounds = getGroupBounds(layersRef.current, focusedIdsRef.current);
    scaleCenterRef.current = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }, []);

  const handleScaleMove = useCallback((scaleFactor: number) => {
    const { setLayers, focusedIdsRef } = p.current;
    const snapshot = scaleSnapshotRef.current;
    const center = scaleCenterRef.current;
    const ids = new Set(focusedIdsRef.current);
    setLayers(snapshot.map(layer =>
      ids.has(layer.id) ? applyScale(layer, scaleFactor, scaleFactor, center.x, center.y) : layer
    ));
  }, []);

  const handleScaleEnd = useCallback(() => {
    const { layersRef, setLayers, pushUndo, scheduleSave } = p.current;
    // Arrondir le fontSize des TextLayer au relâchement
    const finalLayers = layersRef.current.map(l =>
      l.tool === 'text' ? roundTextBoxFontSize(l) : l
    );
    setLayers(finalLayers);
    pushUndo(finalLayers);
    scheduleSave();
    scaleSnapshotRef.current = [];
  }, []);

  // ─── Rotate handlers (appelés par BoundingBoxHandles mode rotate via Konva drag) ──
  const handleRotateStart = useCallback(() => {
    const { layersRef, focusedIdsRef } = p.current;
    rotateSnapshotRef.current = layersRef.current.map(l => ({ ...l }));
    const bounds = getGroupBounds(layersRef.current, focusedIdsRef.current);
    rotateCenterRef.current = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }, []);

  const handleRotateMove = useCallback((angleDeg: number) => {
    const { setLayers, focusedIdsRef } = p.current;
    const snapshot = rotateSnapshotRef.current;
    const center = rotateCenterRef.current;
    const ids = new Set(focusedIdsRef.current);
    const rotated = snapshot.map(layer =>
      ids.has(layer.id) ? applyRotation(layer, angleDeg, center.x, center.y) : layer
    );
    rotateLatestRef.current = rotated; // mise à jour synchrone
    setLayers(rotated);
  }, []);

  const handleRotateEnd = useCallback(() => {
    const { setLayers, pushUndo, scheduleSave } = p.current;
    // Utiliser rotateLatestRef (synchrone) au lieu de layersRef (stale si React n'a pas rendu)
    const finalLayers = rotateLatestRef.current;
    setLayers(finalLayers);
    pushUndo(finalLayers);
    scheduleSave();
    rotateSnapshotRef.current = [];
    rotateLatestRef.current = [];
  }, []);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTapById,
    handleDragEnd,
    handleSelectItem,
    handleScaleStart,
    handleScaleMove,
    handleScaleEnd,
    handleRotateStart,
    handleRotateMove,
    handleRotateEnd,
    selRect,
    currentStroke,
    currentAirbrush,
    liveLineRef,
    textNodesRef,
  };
}
