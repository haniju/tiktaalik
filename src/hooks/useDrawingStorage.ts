import { Drawing } from '../types';

const STORAGE_KEY = 'sketchpad_drawings';

export function useDrawingStorage() {
  const getAll = (): Drawing[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  };

  const save = (drawing: Drawing): void => {
    const all = getAll();
    const idx = all.findIndex(d => d.id === drawing.id);
    if (idx >= 0) all[idx] = drawing;
    else all.unshift(drawing);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  };

  const remove = (id: string): void => {
    const all = getAll().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  };

  const rename = (id: string, name: string): void => {
    const all = getAll();
    const idx = all.findIndex(d => d.id === id);
    if (idx >= 0) { all[idx].name = name; all[idx].updatedAt = Date.now(); }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  };

  return { getAll, save, remove, rename };
}
