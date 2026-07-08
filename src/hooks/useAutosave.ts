import { useRef, useCallback, useEffect, useState } from 'react';
import { Drawing, DrawLayer, DrawingSession, GridSettings, DEFAULT_GRID_SETTINGS, CanvasConfig, DEFAULT_CANVAS_CONFIG } from '../types';
import { generateThumbnail } from '../utils/export';
import { dbGetDrawing, dbPutDrawing } from '../utils/db';
import { useDrawingStorage } from './useDrawingStorage';

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
  const showGridRef = useRef<boolean>(drawing.showGrid ?? false);
  const gridSettingsRef = useRef<GridSettings>(drawing.gridSettings ?? DEFAULT_GRID_SETTINGS);
  const canvasConfigRef = useRef<CanvasConfig>(drawing.canvasConfig ?? DEFAULT_CANVAS_CONFIG);
  const drawingNameRef = useRef<string>(drawing.name);
  const imageKeysRef = useRef<Set<string>>(new Set(drawing.imageKeys ?? []));
  const isDirtyRef = useRef(false);
  const savingRef = useRef(false); // empêche les saves concurrents
  const [saveError, setSaveError] = useState(false);

  // Zoom/pan vivent sur le stage Konva (impératif) et l'outil courant dans useToolState :
  // on les lit à la demande au moment du save plutôt que de les suivre à chaque événement.
  const getSessionRef = useRef<() => DrawingSession>(() => ({}));

  const saveNow = useCallback(async () => {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    if (!isDirtyRef.current) return;
    if (savingRef.current) return; // save déjà en cours
    savingRef.current = true;
    try {
      const bg = canvasBgRef.current;
      const cc = canvasConfigRef.current;
      const thumb = await generateThumbnail(layersRef.current, cc.canvasWidth, cc.canvasHeight, bg);
      const ok = await storage.save({ ...drawing, name: drawingNameRef.current, layers: layersRef.current, background: bg, showGrid: showGridRef.current, gridSettings: gridSettingsRef.current, canvasConfig: cc, session: getSessionRef.current(), imageKeys: [...imageKeysRef.current], updatedAt: Date.now(), thumbnail: thumb });
      if (ok) {
        isDirtyRef.current = false;
        setIsDirty(false);
        setSaveError(false);
        console.log('[autosave]', new Date().toLocaleTimeString());
      } else {
        setSaveError(true);
        console.warn('[autosave] save failed — will retry on next scheduleSave');
      }
    } catch (e) {
      setSaveError(true);
      console.warn('[autosave] save error', e);
    } finally {
      savingRef.current = false;
    }
  }, [drawing, storage, setIsDirty]);

  /**
   * Écrit uniquement `session` (zoom, pan, outil, palettes) dans le dessin stocké.
   * Ni thumbnail ni `updatedAt` : un simple zoom ne doit pas réordonner la galerie.
   */
  const saveSessionNow = useCallback(async () => {
    // Un save complet est en cours ou imminent → il embarquera déjà la session
    if (savingRef.current || isDirtyRef.current) return;
    try {
      const stored = await dbGetDrawing(drawing.id);
      if (!stored) return; // dessin supprimé entre-temps
      await dbPutDrawing({ ...stored, session: getSessionRef.current() });
    } catch (e) {
      console.warn('[autosave] session save error', e);
    }
  }, [drawing.id]);

  // Ref stable vers saveNow — évite que scheduleSave / useEffect recréent un timer
  // à chaque render (storage instable → saveNow instable → useEffect cleanup cancel le timer)
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;
  const saveSessionNowRef = useRef(saveSessionNow);
  saveSessionNowRef.current = saveSessionNow;

  /** Flush complet : données si dirty, sinon session seule. À appeler avant de quitter l'écran. */
  const flushAll = useCallback(async () => {
    await saveNowRef.current();
    await saveSessionNowRef.current();
  }, []);

  const scheduleSave = useCallback(() => {
    isDirtyRef.current = true;
    setIsDirty(true);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { saveNowRef.current(); }, 4000);
  }, []); // stable — lit saveNow via ref, setIsDirty est stable (useState)

  // Save immédiat sur visibilitychange / beforeunload
  useEffect(() => {
    // Best-effort : beforeunload ne permet pas d'attendre les promesses IndexedDB
    const onVisChange = () => { if (document.hidden) flushAll(); };
    const onBeforeUnload = () => { flushAll(); };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [flushAll]); // flushAll est stable (refs)

  return { saveNow, saveSessionNow, flushAll, scheduleSave, getSessionRef, layersRef, canvasBgRef, showGridRef, gridSettingsRef, canvasConfigRef, drawingNameRef, imageKeysRef, isDirtyRef, saveError, setSaveError };
}
