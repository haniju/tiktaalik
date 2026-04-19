import React, { useRef, useState } from 'react';
import { Group, Rect, Line } from 'react-konva';
import { Rect as RectType } from '../utils/bounds';

interface Props {
  bounds: RectType;
  stageScale: number;
  onScaleStart: () => void;
  onScaleMove: (scaleFactor: number) => void;
  onScaleEnd: () => void;
}

const HANDLE_SIZE = 10; // taille écran en px
const HIT_SIZE = 30;    // zone d'accroche invisible

export function BoundingBoxHandles({
  bounds, stageScale, onScaleStart, onScaleMove, onScaleEnd,
}: Props) {
  const handleSize = HANDLE_SIZE / stageScale;
  const hitSize = HIT_SIZE / stageScale;

  // Centre du bounds — fixe pendant un scale uniforme
  const origCenterRef = useRef({ x: 0, y: 0 });
  const origDistRef = useRef(0);
  const [dragCornerPos, setDragCornerPos] = useState<{ x: number; y: number } | null>(null);

  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  const corners = [
    { x: bounds.x, y: bounds.y },                                    // top-left
    { x: bounds.x + bounds.width, y: bounds.y },                     // top-right
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },     // bottom-right
    { x: bounds.x, y: bounds.y + bounds.height },                    // bottom-left
  ];

  return (
    <Group>
      {/* Bounding box pointillée */}
      <Rect
        x={bounds.x} y={bounds.y}
        width={bounds.width} height={bounds.height}
        stroke="#f4a261"
        strokeWidth={1.5 / stageScale}
        dash={[6 / stageScale, 3 / stageScale]}
        listening={false}
      />

      {/* 4 handles aux coins */}
      {corners.map((corner, i) => (
        <Group key={i}>
          {/* Zone d'accroche invisible */}
          <Rect
            x={corner.x - hitSize / 2}
            y={corner.y - hitSize / 2}
            width={hitSize}
            height={hitSize}
            fill="transparent"
            draggable
            onDragStart={() => {
              origCenterRef.current = { x: cx, y: cy };
              origDistRef.current = Math.hypot(corner.x - cx, corner.y - cy);
              onScaleStart();
            }}
            onDragMove={(e) => {
              const node = e.target;
              const newX = node.x() + hitSize / 2;
              const newY = node.y() + hitSize / 2;
              const oc = origCenterRef.current;
              const newDist = Math.hypot(newX - oc.x, newY - oc.y);
              const sf = origDistRef.current > 0 ? newDist / origDistRef.current : 1;
              setDragCornerPos({ x: newX, y: newY });
              onScaleMove(sf);
            }}
            onDragEnd={(e) => {
              // Reset position — le re-render React va la remettre correctement
              e.target.position({
                x: corner.x - hitSize / 2,
                y: corner.y - hitSize / 2,
              });
              setDragCornerPos(null);
              onScaleEnd();
            }}
          />
          {/* Carré visible */}
          <Rect
            x={corner.x - handleSize / 2}
            y={corner.y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill="#f4a261"
            stroke="#fff"
            strokeWidth={1 / stageScale}
            cornerRadius={2 / stageScale}
            listening={false}
          />
        </Group>
      ))}

      {/* Ligne diagonale indicatrice pendant le drag */}
      {dragCornerPos && (
        <Line
          points={[origCenterRef.current.x, origCenterRef.current.y, dragCornerPos.x, dragCornerPos.y]}
          stroke="#f4a261"
          strokeWidth={1 / stageScale}
          dash={[4 / stageScale, 4 / stageScale]}
          opacity={0.6}
          listening={false}
        />
      )}
    </Group>
  );
}
