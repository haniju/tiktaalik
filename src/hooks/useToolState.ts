import { useState, useCallback, useRef } from 'react';
import { Tool, DrawingTool, CanvasMode, ToolState } from '../types';

const STORAGE_KEY = 'sketchpad_tool_state';

const DEFAULT_STATE: ToolState = {
  activeTool: 'pen',
  canvasMode: 'draw',
  toolColors: { airbrush: '#e63946', pen: '#000000', marker: '#2196f3' },
  toolWidths: { airbrush: 10, pen: 5, marker: 10 },
  toolOpacities: { airbrush: 1, pen: 1, marker: 0.4 },
};

function loadPersisted(): Partial<ToolState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function persist(state: ToolState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      toolColors: state.toolColors,
      toolWidths: state.toolWidths,
      toolOpacities: state.toolOpacities,
    }));
  } catch {}
}

export type ContextPanel = 'drawing' | 'text' | 'background' | null;

export function useToolState() {
  const persisted = loadPersisted();
  const [state, setState] = useState<ToolState>({
    ...DEFAULT_STATE,
    toolColors: { ...DEFAULT_STATE.toolColors, ...persisted.toolColors },
    toolWidths: { ...DEFAULT_STATE.toolWidths, ...persisted.toolWidths },
    toolOpacities: { ...DEFAULT_STATE.toolOpacities, ...persisted.toolOpacities },
  });
  const [contextPanel, setContextPanel] = useState<ContextPanel>(null);

  // Refs pour lire l'état courant sans créer de dépendances dans useCallback
  const stateRef = useRef(state);
  stateRef.current = state;
  const contextPanelRef = useRef(contextPanel);
  contextPanelRef.current = contextPanel;

  const selectDrawingTool = useCallback((tool: DrawingTool) => {
    const { activeTool, canvasMode } = stateRef.current;
    const isSame = activeTool === tool && canvasMode === 'draw';
    if (isSame) {
      // Même outil → toggle panel
      setContextPanel(p => p === 'drawing' ? null : 'drawing');
    } else {
      // Outil différent mais panel drawing ouvert → le garder ouvert
      setContextPanel(contextPanelRef.current === 'drawing' ? 'drawing' : null);
      setState(prev => ({ ...prev, activeTool: tool, canvasMode: 'draw' }));
    }
  }, []);

  const selectTextTool = useCallback(() => {
    const { activeTool, canvasMode } = stateRef.current;
    const isSame = activeTool === 'text' && canvasMode === 'draw';
    if (isSame) {
      setContextPanel(p => p === 'text' ? null : 'text');
    } else {
      setContextPanel(null); // ferme le panel drawing si ouvert
      setState(prev => ({ ...prev, activeTool: 'text', canvasMode: 'draw' }));
    }
  }, []);

  const selectEraser = useCallback(() => {
    const { activeTool, canvasMode } = stateRef.current;
    const isSame = activeTool === 'eraser' && canvasMode === 'draw';
    if (!isSame) {
      setContextPanel(null); // ferme tout panel ouvert
      setState(prev => ({ ...prev, activeTool: 'eraser', canvasMode: 'draw' }));
    }
  }, []);

  const selectBackground = useCallback(() => {
    setContextPanel(p => p === 'background' ? null : 'background');
    setState(prev => ({ ...prev, canvasMode: 'draw' }));
  }, []);

  const setCanvasMode = useCallback((mode: CanvasMode) => {
    if (mode === 'move' || mode === 'select') {
      setContextPanel(null);
      setState(prev => ({ ...prev, canvasMode: mode, activeTool: null }));
    } else {
      setState(prev => ({ ...prev, canvasMode: mode }));
    }
  }, []);

  const collapsePanel = useCallback(() => setContextPanel(null), []);

  const setToolColor = useCallback((tool: DrawingTool, color: string) => {
    setState(prev => {
      const next = { ...prev, toolColors: { ...prev.toolColors, [tool]: color } };
      persist(next); return next;
    });
  }, []);

  const setToolWidth = useCallback((tool: DrawingTool, width: number) => {
    setState(prev => {
      const next = { ...prev, toolWidths: { ...prev.toolWidths, [tool]: width } };
      persist(next); return next;
    });
  }, []);

  const setToolOpacity = useCallback((tool: DrawingTool, opacity: number) => {
    setState(prev => {
      const next = { ...prev, toolOpacities: { ...prev.toolOpacities, [tool]: opacity } };
      persist(next); return next;
    });
  }, []);

  const activeColor = state.activeTool && ['airbrush', 'pen', 'marker'].includes(state.activeTool)
    ? state.toolColors[state.activeTool as DrawingTool] : '#000000';
  const activeWidth = state.activeTool && ['airbrush', 'pen', 'marker'].includes(state.activeTool)
    ? state.toolWidths[state.activeTool as DrawingTool] : 5;

  // Compat ancien code
  const topbarMode = state.canvasMode as any;
  const openPanel: any = contextPanel === 'background' ? 'colorpicker' : contextPanel === 'drawing' ? 'drawing' : contextPanel === 'text' ? 'text' : null;
  const setOpenPanel = (p: any) => setContextPanel(p === 'colorpicker' ? 'background' : p === 'drawing' ? 'drawing' : p === 'text' ? 'text' : null);

  return {
    state, contextPanel, setContextPanel,
    selectDrawingTool, selectTextTool, selectEraser, selectBackground,
    setCanvasMode, collapsePanel,
    setToolColor, setToolWidth, setToolOpacity,
    activeColor, activeWidth,
    topbarMode, openPanel, setOpenPanel,
    setTopbarMode: setCanvasMode,
    selectTool: (t: Tool) => setState(prev => ({ ...prev, activeTool: t })),
  };
}
