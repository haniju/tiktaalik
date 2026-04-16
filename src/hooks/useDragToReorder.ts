import { useRef, useState, useCallback } from 'react';

const LONG_PRESS_MS = 350;
const SCROLL_ZONE = 60;
const SCROLL_MAX_SPEED = 10;

export interface DragState {
  draggingId: string | null;       // item "principal" du drag
  insertIndex: number | null;      // position d'insertion dans la liste complète
  isDragging: boolean;
  longPressReady: boolean;         // long-press déclenché, en attente de mouvement ou release
  pointerX: number;                // position courante du doigt (pour "suit le doigt")
  pointerY: number;
}

interface UseDragToReorderProps<T> {
  items: T[];
  getId: (item: T) => string;
  selectedIds: string[];           // ids en "selected mode"
  onReorder: (newItems: T[]) => void;
  onSelect: (id: string) => void;  // tap court → sélectionne/désélectionne
  onLongPressRelease?: (id: string) => void; // long-press sans drag → sélection
  scrollContainerRef: React.RefObject<HTMLElement>;
  layout?: 'horizontal' | 'grid'; // défaut: 'horizontal'
}

const INITIAL_STATE: DragState = {
  draggingId: null, insertIndex: null, isDragging: false, longPressReady: false, pointerX: 0, pointerY: 0,
};

export function useDragToReorder<T>({
  items, getId, selectedIds, onReorder, onSelect, onLongPressRelease, scrollContainerRef, layout = 'horizontal',
}: UseDragToReorderProps<T>) {
  const [dragState, setDragState] = useState<DragState>({ ...INITIAL_STATE });

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onLongPressReleaseRef = useRef(onLongPressRelease);
  onLongPressReleaseRef.current = onLongPressRelease;

  const dragStateRef = useRef<DragState>({ ...INITIAL_STATE });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedRef = useRef(false);
  const longPressReadyRef = useRef(false);
  const longPressIdRef = useRef<string | null>(null);
  const isManualScrolling = useRef(false);
  const lastScrollPos = useRef(0); // X pour horizontal, Y pour grid
  const rafRef = useRef<number | null>(null);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const activePointerId = useRef<number | null>(null);
  const docCleanupRef = useRef<(() => void) | null>(null);
  const pointerTargetRef = useRef<HTMLElement | null>(null);
  const touchMoveCleanupRef = useRef<(() => void) | null>(null);

  const isGrid = layout === 'grid';

  const startAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const tick = () => {
      const rect = container.getBoundingClientRect();
      if (isGrid) {
        const relY = pointerYRef.current - rect.top;
        const h = rect.height;
        let speed = 0;
        if (relY < SCROLL_ZONE) speed = -SCROLL_MAX_SPEED * (1 - relY / SCROLL_ZONE);
        else if (relY > h - SCROLL_ZONE) speed = SCROLL_MAX_SPEED * (1 - (h - relY) / SCROLL_ZONE);
        if (speed !== 0) container.scrollTop += speed;
      } else {
        const relX = pointerXRef.current - rect.left;
        const w = rect.width;
        let speed = 0;
        if (relX < SCROLL_ZONE) speed = -SCROLL_MAX_SPEED * (1 - relX / SCROLL_ZONE);
        else if (relX > w - SCROLL_ZONE) speed = SCROLL_MAX_SPEED * (1 - (w - relX) / SCROLL_ZONE);
        if (speed !== 0) container.scrollLeft += speed;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [scrollContainerRef, isGrid]);

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Bloque le scroll natif en interceptant touchmove (non-passive) sur le container
  const blockNativeScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handler = (e: TouchEvent) => { e.preventDefault(); };
    container.addEventListener('touchmove', handler, { passive: false });
    touchMoveCleanupRef.current = () => {
      container.removeEventListener('touchmove', handler);
    };
  }, [scrollContainerRef]);

  const unblockNativeScroll = useCallback(() => {
    if (touchMoveCleanupRef.current) {
      touchMoveCleanupRef.current();
      touchMoveCleanupRef.current = null;
    }
  }, []);

  // Calcule l'index d'insertion selon la position du pointeur
  const calcInsertIndex = useCallback((clientX: number, clientY: number, draggingId: string): number => {
    const container = scrollContainerRef.current;
    if (!container) return itemsRef.current.length;
    const itemEls = Array.from(container.querySelectorAll('[data-drag-id]')) as HTMLElement[];
    const draggedIds = selectedIdsRef.current.includes(draggingId)
      ? selectedIdsRef.current
      : [draggingId];

    if (isGrid) {
      // 2D : trouver l'élément le plus proche par row puis column
      for (let i = 0; i < itemEls.length; i++) {
        const elId = itemEls[i].getAttribute('data-drag-id')!;
        if (draggedIds.includes(elId)) continue;
        const rect = itemEls[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const midX = rect.left + rect.width / 2;
        // Si le pointeur est au-dessus du milieu vertical de cet élément,
        // ou sur la même ligne et avant le milieu horizontal
        if (clientY < midY - rect.height / 4) {
          // Au-dessus de cette row
          return itemsRef.current.findIndex(item => getId(item) === elId);
        }
        if (clientY < midY + rect.height / 4 && clientX < midX) {
          // Même row, avant cet élément
          return itemsRef.current.findIndex(item => getId(item) === elId);
        }
      }
      return itemsRef.current.length;
    } else {
      // 1D horizontal (comportement original)
      for (let i = 0; i < itemEls.length; i++) {
        const elId = itemEls[i].getAttribute('data-drag-id')!;
        if (draggedIds.includes(elId)) continue;
        const rect = itemEls[i].getBoundingClientRect();
        if (clientX < rect.left + rect.width / 2) {
          return itemsRef.current.findIndex(item => getId(item) === elId);
        }
      }
      return itemsRef.current.length;
    }
  }, [scrollContainerRef, getId, isGrid]);

  const commitReorder = useCallback((draggingId: string, insertIndex: number) => {
    const currentItems = itemsRef.current;
    const draggedIds = selectedIdsRef.current.includes(draggingId)
      ? selectedIdsRef.current
      : [draggingId];

    const dragged = currentItems.filter(i => draggedIds.includes(getId(i)));
    const rest = currentItems.filter(i => !draggedIds.includes(getId(i)));

    let insertInRest = rest.length;
    for (let i = 0; i < rest.length; i++) {
      const originalIdx = currentItems.findIndex(item => getId(item) === getId(rest[i]));
      if (originalIdx >= insertIndex) {
        insertInRest = i;
        break;
      }
    }

    const next = [...rest];
    next.splice(insertInRest, 0, ...dragged);
    onReorderRef.current(next);
  }, [getId]);

  const resetDrag = useCallback(() => {
    stopAutoScroll();
    cancelLongPress();
    unblockNativeScroll();
    if (docCleanupRef.current) { docCleanupRef.current(); docCleanupRef.current = null; }
    pointerStartRef.current = null;
    pointerMovedRef.current = false;
    longPressReadyRef.current = false;
    longPressIdRef.current = null;
    isManualScrolling.current = false;
    activePointerId.current = null;
    const reset = { ...INITIAL_STATE };
    dragStateRef.current = reset;
    setDragState(reset);
  }, [stopAutoScroll, cancelLongPress, unblockNativeScroll]);

  // Démarre le drag effectif (appelé depuis le timer ou depuis le premier move après longPressReady)
  const enterDragMode = useCallback((id: string) => {
    const idx = itemsRef.current.findIndex(i => getId(i) === id);
    const state: DragState = {
      draggingId: id, insertIndex: idx, isDragging: true, longPressReady: false,
      pointerX: pointerXRef.current, pointerY: pointerYRef.current,
    };
    dragStateRef.current = state;
    setDragState(state);
    startAutoScroll();

    const onDocMove = (ev: PointerEvent) => {
      if (!ev.isPrimary) return;
      pointerXRef.current = ev.clientX;
      pointerYRef.current = ev.clientY;
      const insertIndex = calcInsertIndex(ev.clientX, ev.clientY, id);
      const s = { ...dragStateRef.current, insertIndex, pointerX: ev.clientX, pointerY: ev.clientY };
      dragStateRef.current = s;
      setDragState(s);
    };
    const onDocUp = (ev: PointerEvent) => {
      if (!ev.isPrimary) return;
      if (dragStateRef.current.isDragging) {
        const { draggingId, insertIndex } = dragStateRef.current;
        if (draggingId !== null && insertIndex !== null) {
          commitReorder(draggingId, insertIndex);
        }
      }
      resetDrag();
    };
    const onDocCancel = () => resetDrag();

    document.addEventListener('pointermove', onDocMove);
    document.addEventListener('pointerup', onDocUp);
    document.addEventListener('pointercancel', onDocCancel);
    docCleanupRef.current = () => {
      document.removeEventListener('pointermove', onDocMove);
      document.removeEventListener('pointerup', onDocUp);
      document.removeEventListener('pointercancel', onDocCancel);
    };
  }, [getId, startAutoScroll, calcInsertIndex, commitReorder, resetDrag]);

  const getDragHandlers = useCallback((id: string) => ({
    'data-drag-id': id,

    onPointerDown: (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      activePointerId.current = e.pointerId;
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      pointerMovedRef.current = false;
      longPressReadyRef.current = false;
      longPressIdRef.current = null;
      isManualScrolling.current = false;
      pointerXRef.current = e.clientX;
      pointerYRef.current = e.clientY;

      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (pointerMovedRef.current) return;

        if (onLongPressReleaseRef.current) {
          // Mode deux phases : longPressReady, en attente de move (→ drag) ou release (→ select)
          longPressReadyRef.current = true;
          longPressIdRef.current = id;
          navigator.vibrate?.(50);
          blockNativeScroll();
          const state: DragState = {
            ...dragStateRef.current, longPressReady: true, draggingId: id,
            pointerX: pointerXRef.current, pointerY: pointerYRef.current,
          };
          dragStateRef.current = state;
          setDragState(state);
        } else {
          // Mode direct (comportement original) : long-press → drag immédiat
          enterDragMode(id);
        }
      }, LONG_PRESS_MS);
    },

    onPointerMove: (e: React.PointerEvent) => {
      if (!e.isPrimary || activePointerId.current !== e.pointerId) return;
      if (dragStateRef.current.isDragging) return;

      pointerXRef.current = e.clientX;
      pointerYRef.current = e.clientY;

      // Si longPressReady : le moindre mouvement déclenche le drag
      if (longPressReadyRef.current && longPressIdRef.current) {
        enterDragMode(longPressIdRef.current);
        return;
      }

      // Détecter mouvement → annuler long-press et basculer en scroll manuel
      if (pointerStartRef.current && !pointerMovedRef.current) {
        const dx = Math.abs(e.clientX - pointerStartRef.current.x);
        const dy = Math.abs(e.clientY - pointerStartRef.current.y);
        if (dx > 8 || dy > 8) {
          pointerMovedRef.current = true;
          cancelLongPress();
          isManualScrolling.current = true;
          lastScrollPos.current = isGrid ? e.clientY : e.clientX;
        }
      }

      // Scroll manuel
      if (isManualScrolling.current) {
        const container = scrollContainerRef.current;
        if (container) {
          if (isGrid) {
            const deltaY = lastScrollPos.current - e.clientY;
            container.scrollTop += deltaY;
            lastScrollPos.current = e.clientY;
          } else {
            const deltaX = lastScrollPos.current - e.clientX;
            container.scrollLeft += deltaX;
            lastScrollPos.current = e.clientX;
          }
        }
      }
    },

    onPointerUp: (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      if (dragStateRef.current.isDragging) return;

      cancelLongPress();

      // Long-press reconnu mais pas de drag → sélection via onLongPressRelease
      if (longPressReadyRef.current && longPressIdRef.current) {
        onLongPressReleaseRef.current?.(longPressIdRef.current);
        resetDrag();
        return;
      }

      // Tap court
      if (!pointerMovedRef.current) {
        onSelectRef.current(id);
      }
      resetDrag();
    },

    onPointerCancel: () => {
      if (dragStateRef.current.isDragging) return;
      cancelLongPress();
      resetDrag();
    },
  }), [getId, enterDragMode, cancelLongPress, resetDrag, scrollContainerRef, isGrid]);

  return { dragState, getDragHandlers };
}
