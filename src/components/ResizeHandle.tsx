import React, { useRef } from 'react';
import Konva from 'konva';
import { Rect, Group } from 'react-konva';

export interface ResizeHandleProps {
  cx: number; cy: number;
  side: 'left' | 'right';
  tb: { x: number; y: number; width: number; rotation?: number };
  stageRef: React.RefObject<Konva.Stage>;
  onMove: (newX: number, newWidth: number) => void;
  onDragEnd: () => void;
  onTap?: (e: Konva.KonvaEventObject<Event>) => void;
}

// Taille visuelle du petit carré (px écran)
const KNOB_SCREEN = 10;
// Taille de la zone d'accroche invisible (px écran)
const HIT_SCREEN = 30;

export function ResizeHandle({ cx, cy, side, tb, stageRef, onMove, onDragEnd, onTap }: ResizeHandleProps) {
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    lockedScreenY: number;
    tbX: number;
    tbWidth: number;
  } | null>(null);
  const knobRef = useRef<Konva.Rect>(null);

  const sc = stageRef.current?.scaleX() ?? 1;
  const knob = KNOB_SCREEN / sc;
  const hit = HIT_SCREEN / sc;

  return (
    <Group
      x={cx} y={cy}
      draggable
      dragBoundFunc={pos => pos}
      onDragStart={e => {
        dragStartRef.current = {
          pointerX: e.target.absolutePosition().x,
          pointerY: e.target.absolutePosition().y,
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
        const dxScreen = (abs.x - dragStartRef.current.pointerX) / scl;
        const dyScreen = (abs.y - dragStartRef.current.pointerY) / scl;

        // Projeter le déplacement écran sur l'axe local X du TB (tient compte de la rotation)
        const rotation = tb.rotation ?? 0;
        const rad = (rotation * Math.PI) / 180;
        const dxCanvas = dxScreen * Math.cos(rad) + dyScreen * Math.sin(rad);

        if (side === 'left') {
          const newWidth = Math.max(dragStartRef.current.tbWidth - dxCanvas, 150);
          const effectiveDx = dragStartRef.current.tbWidth - newWidth;
          const newX = dragStartRef.current.tbX + effectiveDx;
          onMove(newX, newWidth);
        } else {
          const newWidth = Math.max(dragStartRef.current.tbWidth + dxCanvas, 150);
          onMove(dragStartRef.current.tbX, newWidth);
        }

        // Compenser le déplacement du Group pour que le knob reste accroché au bord de la TB
        const groupPos = e.target.position();
        if (knobRef.current) {
          knobRef.current.position({ x: -knob / 2 - groupPos.x + cx, y: -knob / 2 - groupPos.y + cy });
        }
      }}
      onDragEnd={e => {
        dragStartRef.current = null;
        e.target.position({ x: cx, y: cy });
        if (knobRef.current) knobRef.current.position({ x: -knob / 2, y: -knob / 2 });
        onDragEnd();
      }}
      onClick={onTap}
      onTap={onTap}
      onMouseEnter={() => { if (stageRef.current) stageRef.current.container().style.cursor = 'ew-resize'; }}
      onMouseLeave={() => { if (stageRef.current) stageRef.current.container().style.cursor = ''; }}
    >
      {/* Zone d'accroche invisible — hit area large */}
      <Rect
        x={-hit / 2} y={-hit / 2}
        width={hit} height={hit}
        fill="transparent"
      />
      {/* Poignée visible — petit carré plein, reste accroché au bord de la TB pendant le drag */}
      <Rect
        ref={knobRef}
        x={-knob / 2} y={-knob / 2}
        width={knob} height={knob}
        fill="#333" cornerRadius={2 / sc}
        listening={false}
      />
    </Group>
  );
}
