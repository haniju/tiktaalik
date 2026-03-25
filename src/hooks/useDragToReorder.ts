import { useRef, useState, useCallback } from 'react';

const LONG_PRESS_MS = 350;
const SCROLL_ZONE = 60;
const SCROLL_MAX_SPEED = 10;

export interface DragState {
  draggingId: string | null;       // item "principal" du drag
  insertIndex: number | null;      // position d'insertion dans la liste complète
  isDragging: boolean;
  pointerX: number;                // position courante du doigt (pour "suit le doigt")
  pointerY: number;
}

interface UseDragToReorderProps<T> {
  items: T[];
  getId: (item: T) => string;
  selectedIds: string[];           // ids en "selected mode"
  onReorder: (newItems: T[]) => void;
  onSelect: (id: string) => void;  // tap court → sélectionne/désélectionne
  scrollContainerRef: React.RefObject<HTMLElement>;
}

export function useDragToReorder<T>({
  items, getId, selectedIds, onReorder, onSelect, scrollContainerRef,
}: UseDragToReorderProps<T>) {
  const [dragState, setDragState] = useState<DragState>({
    draggingId: null, insertIndex: null, isDragging: false, pointerX: 0, pointerY: 0,
  });

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const dragStateRef = useRef<DragState>({ draggingId: null, insertIndex: null, isDragging: false, pointerX: 0, pointerY: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedRef = useRef(false);
  const isManualScrolling = useRef(false);
  const lastScrollX = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const activePointerId = useRef<number | null>(null);
  // Ref pour stocker le cleanup des listeners document (pendant drag)
  const docCleanupRef = useRef<(() => void) | null>(null);

  const startAutoScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const tick = () => {
      const rect = container.getBoundingClientRect();
      const relX = pointerXRef.current - rect.left;
      const w = rect.width;
      let speed = 0;
      if (relX < SCROLL_ZONE) speed = -SCROLL_MAX_SPEED * (1 - relX / SCROLL_ZONE);
      else if (relX > w - SCROLL_ZONE) speed = SCROLL_MAX_SPEED * (1 - (w - relX) / SCROLL_ZONE);
      if (speed !== 0) container.scrollLeft += speed;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [scrollContainerRef]);

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Calcule l'index d'insertion dans la liste complète selon clientX
  const calcInsertIndex = useCallback((clientX: number, draggingId: string): number => {
    const container = scrollContainerRef.current;
    if (!container) return itemsRef.current.length;
    const itemEls = Array.from(container.querySelectorAll('[data-drag-id]')) as HTMLElement[];
    const draggedIds = selectedIdsRef.current.includes(draggingId)
      ? selectedIdsRef.current
      : [draggingId];

    for (let i = 0; i < itemEls.length; i++) {
      const elId = itemEls[i].getAttribute('data-drag-id')!;
      if (draggedIds.includes(elId)) continue;
      const rect = itemEls[i].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        return itemsRef.current.findIndex(item => getId(item) === elId);
      }
    }
    return itemsRef.current.length;
  }, [scrollContainerRef, getId]);

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
    // Retirer les listeners document
    if (docCleanupRef.current) { docCleanupRef.current(); docCleanupRef.current = null; }
    pointerStartRef.current = null;
    pointerMovedRef.current = false;
    isManualScrolling.current = false;
    activePointerId.current = null;
    const reset = { draggingId: null, insertIndex: null, isDragging: false, pointerX: 0, pointerY: 0 };
    dragStateRef.current = reset;
    setDragState(reset);
  }, [stopAutoScroll, cancelLongPress]);

  const getDragHandlers = useCallback((id: string) => ({
    'data-drag-id': id,

    onPointerDown: (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      activePointerId.current = e.pointerId;
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      pointerMovedRef.current = false;
      isManualScrolling.current = false;
      pointerXRef.current = e.clientX;
      pointerYRef.current = e.clientY;

      // Démarrer le timer long press
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (pointerMovedRef.current) return;

        // Long press reconnu → démarrer le drag
        const idx = itemsRef.current.findIndex(i => getId(i) === id);
        const state = {
          draggingId: id, insertIndex: idx, isDragging: true,
          pointerX: pointerXRef.current, pointerY: pointerYRef.current,
        };
        dragStateRef.current = state;
        setDragState(state);
        startAutoScroll();

        // Attacher les listeners sur document pour garantir le cleanup
        const onDocMove = (ev: PointerEvent) => {
          if (!ev.isPrimary) return;
          pointerXRef.current = ev.clientX;
          pointerYRef.current = ev.clientY;
          const insertIndex = calcInsertIndex(ev.clientX, id);
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
      }, LONG_PRESS_MS);
    },

    // Avant long-press : scroll manuel ou annulation
    onPointerMove: (e: React.PointerEvent) => {
      if (!e.isPrimary || activePointerId.current !== e.pointerId) return;
      // Si le drag est actif, les listeners document gèrent le mouvement
      if (dragStateRef.current.isDragging) return;

      pointerXRef.current = e.clientX;
      pointerYRef.current = e.clientY;

      // Détecter mouvement → annuler long-press et basculer en scroll manuel
      if (pointerStartRef.current && !pointerMovedRef.current) {
        const dx = Math.abs(e.clientX - pointerStartRef.current.x);
        const dy = Math.abs(e.clientY - pointerStartRef.current.y);
        if (dx > 8 || dy > 8) {
          pointerMovedRef.current = true;
          cancelLongPress();
          isManualScrolling.current = true;
          lastScrollX.current = e.clientX;
        }
      }

      // Scroll manuel
      if (isManualScrolling.current) {
        const container = scrollContainerRef.current;
        if (container) {
          const deltaX = lastScrollX.current - e.clientX;
          container.scrollLeft += deltaX;
          lastScrollX.current = e.clientX;
        }
      }
    },

    onPointerUp: (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      // Si drag actif, le listener document gère le pointerup
      if (dragStateRef.current.isDragging) return;

      cancelLongPress();
      if (!pointerMovedRef.current) {
        onSelectRef.current(id);
      }
      resetDrag();
    },

    onPointerCancel: () => {
      if (dragStateRef.current.isDragging) return; // document gère
      cancelLongPress();
      resetDrag();
    },
  }), [getId, startAutoScroll, cancelLongPress, calcInsertIndex, commitReorder, resetDrag, scrollContainerRef]);

  return { dragState, getDragHandlers };
}
