import { Drawing } from '../types';

const ORDER_KEY = 'sketchpad_drawing_order';

export function useDrawingOrder() {
  const getOrder = (): string[] => {
    try {
      const data = localStorage.getItem(ORDER_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  };

  const saveOrder = (ids: string[]): void => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
  };

  const removeFromOrder = (id: string): void => {
    const order = getOrder().filter(x => x !== id);
    saveOrder(order);
  };

  /**
   * Trie les drawings selon l'ordre persisté.
   * - Nouveaux drawings (absents du tableau) → en tête, triés par createdAt desc
   * - Drawings dans le tableau → dans l'ordre du tableau
   * - IDs périmés (dans le tableau mais pas dans drawings) → filtrés
   */
  const applyOrder = (drawings: Drawing[]): Drawing[] => {
    const order = getOrder();
    if (order.length === 0) return drawings;

    const drawingMap = new Map(drawings.map(d => [d.id, d]));
    const orderSet = new Set(order);

    const newDrawings = drawings
      .filter(d => !orderSet.has(d.id))
      .sort((a, b) => b.createdAt - a.createdAt);

    const ordered = order
      .filter(id => drawingMap.has(id))
      .map(id => drawingMap.get(id)!);

    return [...newDrawings, ...ordered];
  };

  return { getOrder, saveOrder, removeFromOrder, applyOrder };
}
