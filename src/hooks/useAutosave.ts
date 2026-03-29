import { useRef, useCallback, useEffect } from 'react';
import { Drawing, DrawLayer } from '../types';
import { generateThumbnail } from '../utils/export';
import { useDrawingStorage } from './useDrawingStorage';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

interface UseAutosaveOptions {
  drawing: Drawing;
  storage: ReturnType<typeof useDrawingStorage>;
  setIsDirty: (v: boolean) => void;
}

export function useAutosave({ drawing, storage, setIsDirty }: UseAutosaveOptions) {
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs mis à jour à chaque render par le composant appelant
  const layersRef = useRef<DrawLayer[]>([]);
  const canvasBgRef = useRef<string>('#ffffff');
  const drawingNameRef = useRef<string>(drawing.name);
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
  }, [drawing, storage, setIsDirty]);

  // Ref stable vers saveNow — évite que scheduleSave / useEffect recréent un timer
  // à chaque render (storage instable → saveNow instable → useEffect cleanup cancel le timer)
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;

  const scheduleSave = useCallback(() => {
    isDirtyRef.current = true;
    setIsDirty(true);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => saveNowRef.current(), 4000);
  }, []); // stable — lit saveNow via ref, setIsDirty est stable (useState)

  // Save immédiat sur visibilitychange / beforeunload
  useEffect(() => {
    const onVisChange = () => { if (document.hidden) saveNowRef.current(); };
    const onBeforeUnload = () => saveNowRef.current();
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []); // saveNowRef est stable — pointe toujours vers le saveNow courant

  return { saveNow, scheduleSave, layersRef, canvasBgRef, drawingNameRef, isDirtyRef };
}
