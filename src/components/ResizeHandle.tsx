import React, { useRef } from 'react';
import Konva from 'konva';
import { Rect, Group } from 'react-konva';

export interface ResizeHandleProps {
  cx: number; cy: number;
  side: 'left' | 'right';
  tb: { x: number; y: number; width: number };
  stageRef: React.RefObject<Konva.Stage>;
  onMove: (newX: number, newWidth: number) => void;
  onDragEnd: () => void;
}

// Taille visuelle du petit carré (px écran)
const KNOB_SCREEN = 10;
// Taille de la zone d'accroche invisible (px écran)
const HIT_SCREEN = 30;

export function ResizeHandle({ cx, cy, side, tb, stageRef, onMove, onDragEnd }: ResizeHandleProps) {
  const dragStartRef = useRef<{
    pointerX: number;
    lockedScreenY: number;
    tbX: number;
    tbWidth: number;
  } | null>(null);

  const sc = stageRef.current?.scaleX() ?? 1;
  const knob = KNOB_SCREEN / sc;
  const hit = HIT_SCREEN / sc;

  return (
    <Group
      x={cx} y={cy}
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
          const maxAbsX = stageX + (start.tbX + start.tbWidth - 150) * scl;
          clampedX = Math.min(pos.x, maxAbsX);
        } else {
          const minAbsX = stageX + (start.tbX + 150) * scl;
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
        e.target.position({ x: cx, y: cy });
        onDragEnd();
      }}
      onMouseEnter={() => { if (stageRef.current) stageRef.current.container().style.cursor = 'ew-resize'; }}
      onMouseLeave={() => { if (stageRef.current) stageRef.current.container().style.cursor = ''; }}
    >
      {/* Zone d'accroche invisible — hit area large */}
      <Rect
        x={-hit / 2} y={-hit / 2}
        width={hit} height={hit}
        fill="transparent"
      />
      {/* Poignée visible — petit carré plein */}
      <Rect
        x={-knob / 2} y={-knob / 2}
        width={knob} height={knob}
        fill="#333" cornerRadius={2 / sc}
        listening={false}
      />
    </Group>
  );
}
