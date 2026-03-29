import React, { useRef } from 'react';
import Konva from 'konva';
import { Rect } from 'react-konva';

export interface ResizeHandleProps {
  cx: number; cy: number;
  side: 'left' | 'right';
  tb: { x: number; y: number; width: number };
  stageRef: React.RefObject<Konva.Stage>;
  onMove: (newX: number, newWidth: number) => void;
  onDragEnd: () => void;
}

// Taille fixe des handles à l'écran (px) — indépendante du zoom
const HANDLE_SCREEN_W = 30;
const HANDLE_SCREEN_H = 36;

// Handle de resize horizontal — milieu bord gauche ou droit
export function ResizeHandle({ cx, cy, side, tb, stageRef, onMove, onDragEnd }: ResizeHandleProps) {
  const dragStartRef = useRef<{
    pointerX: number;      // position écran (absolutePosition) au démarrage
    lockedScreenY: number; // position Y écran verrouillée pour toute la durée du drag
    tbX: number;           // tb.x au démarrage
    tbWidth: number;       // tb.width au démarrage
  } | null>(null);
  // Compenser le zoom : la taille en coordonnées canvas augmente quand on dézoome
  const sc = stageRef.current?.scaleX() ?? 1;
  const hw = HANDLE_SCREEN_W / sc;
  const hh = HANDLE_SCREEN_H / sc;

  return (
    <Rect
      x={cx - hw / 2} y={cy - hh / 2}
      width={hw} height={hh}
      fill="#118ab2" opacity={0.85} cornerRadius={4}
      draggable
      dragBoundFunc={pos => {
        const start = dragStartRef.current;
        const lockedY = start?.lockedScreenY ?? pos.y;
        if (!start || !stageRef.current) return { x: pos.x, y: lockedY };
        const stage = stageRef.current;
        const scl = stage.scaleX();
        const stageX = stage.x();
        let clampedX = pos.x;
        if (side === 'left') {
          // Le handle gauche ne peut pas dépasser vers la droite au-delà de tbX + tbWidth - 150
          const maxAbsX = stageX + (start.tbX + start.tbWidth - 150) * scl - HANDLE_SCREEN_W / 2;
          clampedX = Math.min(pos.x, maxAbsX);
        } else {
          // Le handle droit ne peut pas aller en-dessous de tbX + 150
          const minAbsX = stageX + (start.tbX + 150) * scl - HANDLE_SCREEN_W / 2;
          clampedX = Math.max(pos.x, minAbsX);
        }
        return { x: clampedX, y: lockedY };
      }}
      onDragStart={e => {
        dragStartRef.current = {
          pointerX: e.target.absolutePosition().x,
          lockedScreenY: e.target.absolutePosition().y,
          tbX: tb.x,
          tbWidth: tb.width,
        };
      }}
      onDragMove={e => {
        if (!dragStartRef.current) return;
        const stage = stageRef.current!;
        const scl = stage.scaleX();
        const abs = e.target.absolutePosition();
        const dxCanvas = (abs.x - dragStartRef.current.pointerX) / scl;

        if (side === 'left') {
          const newWidth = Math.max(dragStartRef.current.tbWidth - dxCanvas, 150);
          // effectiveDx : déplacement réel du bord gauche — plafonné pour garder le bord droit fixe
          const effectiveDx = dragStartRef.current.tbWidth - newWidth;
          const newX = dragStartRef.current.tbX + effectiveDx;
          onMove(newX, newWidth);
        } else {
          const newWidth = Math.max(dragStartRef.current.tbWidth + dxCanvas, 150);
          onMove(dragStartRef.current.tbX, newWidth);
        }
      }}
      onDragEnd={e => {
        dragStartRef.current = null;
        e.target.position({ x: cx - hw / 2, y: cy - hh / 2 });
        onDragEnd();
      }}
      onMouseEnter={() => { if (stageRef.current) stageRef.current.container().style.cursor = 'ew-resize'; }}
      onMouseLeave={() => { if (stageRef.current) stageRef.current.container().style.cursor = ''; }}
    />
  );
}
