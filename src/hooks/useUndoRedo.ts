import { useState, useCallback, useEffect } from 'react';
import { DrawLayer } from '../types';

interface UseUndoRedoOptions {
  initialLayers: DrawLayer[];
  setLayers: React.Dispatch<React.SetStateAction<DrawLayer[]>>;
  scheduleSave: () => void;
}

interface UseUndoRedoReturn {
  pushUndo: (layers: DrawLayer[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo({ initialLayers, setLayers, scheduleSave }: UseUndoRedoOptions): UseUndoRedoReturn {
  const [undoStack, setUndoStack] = useState(() => [{ layers: initialLayers }]);
  const [undoIndex, setUndoIndex] = useState(0);

  // Note : stale closure sur undoIndex — comportement existant conservé volontairement
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
  }, [undoIndex, undoStack, setLayers, scheduleSave]);

  const redo = useCallback(() => {
    if (undoIndex >= undoStack.length - 1) return;
    const i = undoIndex + 1;
    setUndoIndex(i);
    setLayers(undoStack[i].layers);
    scheduleSave();
  }, [undoIndex, undoStack, setLayers, scheduleSave]);

  // Raccourci clavier Cmd/Ctrl+Z (et Shift+Z pour redo)
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { if (e.shiftKey) { redo(); } else { undo(); } }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [undo, redo]);

  return {
    pushUndo,
    undo,
    redo,
    canUndo: undoIndex > 0,
    canRedo: undoIndex < undoStack.length - 1,
  };
}
