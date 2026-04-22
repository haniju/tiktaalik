import { useState, useCallback, useRef } from 'react';
import { Tool, DrawingTool, CanvasMode, ToolState, PreviousMode } from '../types';

const STORAGE_KEY = 'sketchpad_tool_state';

const DEFAULT_STATE: ToolState = {
  activeTool: 'pen',
  canvasMode: 'draw',
  previousMode: null,
  toolColors: { airbrush: '#e63946', pen: '#000000', marker: '#2196f3' },
  toolWidths: { airbrush: 10, pen: 5, marker: 10 },
  toolOpacities: { airbrush: 0.7, pen: 1, marker: 0.4 },
  airbrushEdgeOpacity: 0,
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
      activeTool: state.activeTool,
      canvasMode: state.canvasMode,
      previousMode: state.previousMode,
      toolColors: state.toolColors,
      toolWidths: state.toolWidths,
      toolOpacities: state.toolOpacities,
      airbrushEdgeOpacity: state.airbrushEdgeOpacity,
    }));
  } catch {}
}

export type ContextPanel = 'drawing' | 'text' | 'background' | null;

export function useToolState() {
  const persisted = loadPersisted();
  const [state, setState] = useState<ToolState>({
    ...DEFAULT_STATE,
    activeTool: persisted.activeTool ?? DEFAULT_STATE.activeTool,
    canvasMode: persisted.canvasMode ?? DEFAULT_STATE.canvasMode,
    previousMode: persisted.previousMode ?? null,
    toolColors: { ...DEFAULT_STATE.toolColors, ...persisted.toolColors },
    toolWidths: { ...DEFAULT_STATE.toolWidths, ...persisted.toolWidths },
    toolOpacities: { ...DEFAULT_STATE.toolOpacities, ...persisted.toolOpacities },
    airbrushEdgeOpacity: persisted.airbrushEdgeOpacity ?? DEFAULT_STATE.airbrushEdgeOpacity,
  });
  const [contextPanel, setContextPanel] = useState<ContextPanel>(null);

  // Refs pour lire l'état courant sans créer de dépendances dans useCallback
  const stateRef = useRef(state);
  stateRef.current = state;
  const contextPanelRef = useRef(contextPanel);
  contextPanelRef.current = contextPanel;

  // Helper : efface previousMode et persiste (choix explicite d'un mode/outil)
  const clearPreviousMode = useCallback(() => {
    setState(prev => {
      const next = { ...prev, previousMode: null };
      persist(next); return next;
    });
  }, []);

  const selectDrawingTool = useCallback((tool: DrawingTool) => {
    const { activeTool, canvasMode } = stateRef.current;
    const isSame = activeTool === tool && canvasMode === 'draw';
    if (isSame) {
      // Même outil → toggle panel
      setContextPanel(p => p === 'drawing' ? null : 'drawing');
    } else {
      // Outil différent mais panel drawing ouvert → le garder ouvert
      setContextPanel(contextPanelRef.current === 'drawing' ? 'drawing' : null);
      setState(prev => {
        const next = { ...prev, activeTool: tool, canvasMode: 'draw' as CanvasMode, previousMode: null };
        persist(next); return next;
      });
    }
  }, []);

  const selectTextTool = useCallback(() => {
    const { activeTool, canvasMode } = stateRef.current;
    const isSame = activeTool === 'text' && canvasMode === 'draw';
    if (isSame) {
      setContextPanel(p => p === 'text' ? null : 'text');
    } else {
      setContextPanel(null);
      setState(prev => {
        const next = { ...prev, activeTool: 'text' as Tool, canvasMode: 'draw' as CanvasMode, previousMode: null };
        persist(next); return next;
      });
    }
  }, []);

  const selectEraser = useCallback(() => {
    const { activeTool, canvasMode } = stateRef.current;
    const isSame = activeTool === 'eraser' && canvasMode === 'draw';
    if (!isSame) {
      setContextPanel(null);
      setState(prev => {
        const next = { ...prev, activeTool: 'eraser' as Tool, canvasMode: 'draw' as CanvasMode, previousMode: null };
        persist(next); return next;
      });
    }
  }, []);

  const selectBackground = useCallback(() => {
    setContextPanel(p => p === 'background' ? null : 'background');
    setState(prev => {
      const next = { ...prev, canvasMode: 'draw' as CanvasMode, previousMode: null };
      persist(next); return next;
    });
  }, []);

  const setCanvasMode = useCallback((mode: CanvasMode) => {
    if (mode === 'move') {
      // Mémorise le contexte courant avant d'entrer en pan
      setContextPanel(null);
      setState(prev => {
        const next = {
          ...prev,
          previousMode: { canvasMode: prev.canvasMode, activeTool: prev.activeTool },
          canvasMode: 'move' as CanvasMode,
          activeTool: null as Tool,
        };
        persist(next); return next;
      });
    } else if (mode === 'select') {
      setContextPanel(null);
      setState(prev => {
        const next = { ...prev, canvasMode: mode, activeTool: null as Tool, previousMode: null };
        persist(next); return next;
      });
    } else {
      setState(prev => {
        const next = { ...prev, canvasMode: mode };
        persist(next); return next;
      });
    }
  }, []);

  // Entrer en pan (mémorise le contexte courant)
  const enterPan = useCallback(() => {
    const { canvasMode } = stateRef.current;
    if (canvasMode !== 'move') {
      setCanvasMode('move');
    }
  }, [setCanvasMode]);

  // Sortir du pan (restaure le contexte mémorisé)
  const exitPan = useCallback(() => {
    const { canvasMode, previousMode } = stateRef.current;
    if (canvasMode !== 'move') return;
    if (previousMode) {
      setContextPanel(null);
      setState(prev => {
        const next = {
          ...prev,
          canvasMode: prev.previousMode!.canvasMode,
          activeTool: prev.previousMode!.activeTool,
          previousMode: null,
        };
        persist(next); return next;
      });
    } else {
      setCanvasMode('draw');
    }
  }, [setCanvasMode]);

  // Toggle pan : si on est en move → restaure le mode précédent, sinon → entre en move
  const togglePan = useCallback(() => {
    const { canvasMode } = stateRef.current;
    if (canvasMode === 'move') {
      exitPan();
    } else {
      enterPan();
    }
  }, [enterPan, exitPan]);

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

  const setAirbrushEdgeOpacity = useCallback((opacity: number) => {
    setState(prev => {
      const next = { ...prev, airbrushEdgeOpacity: opacity };
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
    setCanvasMode, enterPan, exitPan, togglePan, collapsePanel,
    setToolColor, setToolWidth, setToolOpacity, setAirbrushEdgeOpacity,
    activeColor, activeWidth,
    topbarMode, openPanel, setOpenPanel,
    setTopbarMode: setCanvasMode,
    selectTool: (t: Tool) => setState(prev => ({ ...prev, activeTool: t })),
  };
}
