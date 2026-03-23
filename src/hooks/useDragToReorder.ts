import { useRef, useState, useCallback } from 'react';

const LONG_PRESS_MS = 500;
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
  const rafRef = useRef<number | null>(null);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const activePointerId = useRef<number | null>(null);

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
    // IDs en train d'être draggés (principal + sélectionnés si principal est selected)
    const draggedIds = selectedIdsRef.current.includes(draggingId)
      ? selectedIdsRef.current
      : [draggingId];

    for (let i = 0; i < itemEls.length; i++) {
      const elId = itemEls[i].getAttribute('data-drag-id')!;
      if (draggedIds.includes(elId)) continue; // ignorer les items draggés
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

    // Séparer items draggés et non-draggés (en conservant leur ordre relatif)
    const dragged = currentItems.filter(i => draggedIds.includes(getId(i)));
    const rest = currentItems.filter(i => !draggedIds.includes(getId(i)));

    // Calculer l'index d'insertion dans `rest`
    // insertIndex est un index dans currentItems → trouver l'équivalent dans rest
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
    pointerStartRef.current = null;
    pointerMovedRef.current = false;
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
      pointerXRef.current = e.clientX;
      pointerYRef.current = e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      // Démarrer le timer long press
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (pointerMovedRef.current) return; // s'est déplacé avant → annuler
        // Long press reconnu → démarrer le drag
        const idx = itemsRef.current.findIndex(i => getId(i) === id);
        const state = {
          draggingId: id, insertIndex: idx, isDragging: true,
          pointerX: pointerXRef.current, pointerY: pointerYRef.current,
        };
        dragStateRef.current = state;
        setDragState(state);
        startAutoScroll();
      }, LONG_PRESS_MS);
    },

    onPointerMove: (e: React.PointerEvent) => {
      if (!e.isPrimary || activePointerId.current !== e.pointerId) return;
      pointerXRef.current = e.clientX;
      pointerYRef.current = e.clientY;

      if (pointerStartRef.current) {
        const dx = Math.abs(e.clientX - pointerStartRef.current.x);
        const dy = Math.abs(e.clientY - pointerStartRef.current.y);
        if (dx > 8 || dy > 8) {
          pointerMovedRef.current = true;
          cancelLongPress(); // mouvement → annule long press
        }
      }

      if (!dragStateRef.current.isDragging) return;

      const insertIndex = calcInsertIndex(e.clientX, id);
      const state = { ...dragStateRef.current, insertIndex, pointerX: e.clientX, pointerY: e.clientY };
      dragStateRef.current = state;
      setDragState(state);
    },

    onPointerUp: (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      cancelLongPress();

      if (dragStateRef.current.isDragging) {
        // Fin du drag → commit
        const { draggingId, insertIndex } = dragStateRef.current;
        if (draggingId !== null && insertIndex !== null) {
          commitReorder(draggingId, insertIndex);
        }
      } else if (!pointerMovedRef.current) {
        // Tap court sans drag → sélectionner/désélectionner
        onSelectRef.current(id);
      }

      resetDrag();
    },

    onPointerCancel: () => {
      cancelLongPress();
      resetDrag();
    },
  }), [getId, startAutoScroll, cancelLongPress, calcInsertIndex, commitReorder, resetDrag]);

  return { dragState, getDragHandlers };
}
