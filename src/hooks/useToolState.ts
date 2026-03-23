import { useState, useCallback } from 'react';
import { Tool, DrawingTool, CanvasMode, ToolState } from '../types';

const STORAGE_KEY = 'sketchpad_tool_state';

const DEFAULT_STATE: ToolState = {
  activeTool: 'pen',
  canvasMode: 'draw',
  toolColors: { airbrush: '#e63946', pen: '#000000', marker: '#2196f3' },
  toolWidths: { airbrush: 10, pen: 5, marker: 10 },
  canvasBackground: '#ffffff',
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
      canvasBackground: state.canvasBackground,
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
    canvasBackground: persisted.canvasBackground ?? DEFAULT_STATE.canvasBackground,
  });
  const [contextPanel, setContextPanel] = useState<ContextPanel>(null);

  const selectDrawingTool = useCallback((tool: DrawingTool) => {
    setState(prev => {
      const isSame = prev.activeTool === tool && prev.canvasMode === 'draw';
      if (isSame) {
        // Même outil → toggle panel
        setContextPanel(p => p === 'drawing' ? null : 'drawing');
        return prev;
      }
      // Outil différent mais panel drawing ouvert → le garder ouvert
      setContextPanel(p => p === 'drawing' ? 'drawing' : null);
      return { ...prev, activeTool: tool, canvasMode: 'draw' };
    });
  }, []);

  const selectTextTool = useCallback(() => {
    setState(prev => {
      const isSame = prev.activeTool === 'text' && prev.canvasMode === 'draw';
      if (isSame) {
        setContextPanel(p => p === 'text' ? null : 'text');
        return prev;
      }
      setContextPanel(null); // ferme le panel drawing si ouvert
      return { ...prev, activeTool: 'text', canvasMode: 'draw' };
    });
  }, []);

  const selectEraser = useCallback(() => {
    setState(prev => {
      const isSame = prev.activeTool === 'eraser' && prev.canvasMode === 'draw';
      if (isSame) return prev;
      setContextPanel(null); // ferme tout panel ouvert
      return { ...prev, activeTool: 'eraser', canvasMode: 'draw' };
    });
  }, []);

  const selectBackground = useCallback(() => {
    setContextPanel(p => p === 'background' ? null : 'background');
    setState(prev => ({ ...prev, canvasMode: 'draw' }));
  }, []);

  const setCanvasMode = useCallback((mode: CanvasMode) => {
    setState(prev => {
      if (mode === 'move' || mode === 'select') {
        setContextPanel(null);
        return { ...prev, canvasMode: mode, activeTool: null };
      }
      return { ...prev, canvasMode: mode };
    });
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

  const setCanvasBackground = useCallback((color: string) => {
    setState(prev => {
      const next = { ...prev, canvasBackground: color };
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
    setToolColor, setToolWidth, setCanvasBackground,
    activeColor, activeWidth,
    topbarMode, openPanel, setOpenPanel,
    setTopbarMode: setCanvasMode,
    selectTool: (t: Tool) => setState(prev => ({ ...prev, activeTool: t })),
  };
}
