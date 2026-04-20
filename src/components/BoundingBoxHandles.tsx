import React, { useRef, useState } from 'react';
import { Group, Rect, Line, Circle } from 'react-konva';
import { Rect as RectType } from '../utils/bounds';

interface ScaleProps {
  bounds: RectType;
  mode: 'scale';
  stageScale: number;
  onScaleStart: () => void;
  onScaleMove: (scaleFactor: number) => void;
  onScaleEnd: () => void;
}

interface RotateProps {
  bounds: RectType;
  mode: 'rotate';
  stageScale: number;
  onRotateStart: () => void;
  onRotateMove: (angleDeg: number) => void;
  onRotateEnd: () => void;
}

type Props = ScaleProps | RotateProps;

const HANDLE_SIZE = 10; // taille écran en px
const HIT_SIZE = 30;    // zone d'accroche invisible
const ROTATE_OFFSET = 30; // distance du handle rotate au-dessus du coin top-right (écran px)

export function BoundingBoxHandles(props: Props) {
  const { bounds, mode, stageScale } = props;
  const handleSize = HANDLE_SIZE / stageScale;
  const hitSize = HIT_SIZE / stageScale;

  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

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

      {mode === 'scale' ? (
        <ScaleHandles
          bounds={bounds} stageScale={stageScale}
          handleSize={handleSize} hitSize={hitSize} cx={cx} cy={cy}
          onScaleStart={(props as ScaleProps).onScaleStart}
          onScaleMove={(props as ScaleProps).onScaleMove}
          onScaleEnd={(props as ScaleProps).onScaleEnd}
        />
      ) : (
        <RotateHandle
          bounds={bounds} stageScale={stageScale}
          handleSize={handleSize} hitSize={hitSize} cx={cx} cy={cy}
          onRotateStart={(props as RotateProps).onRotateStart}
          onRotateMove={(props as RotateProps).onRotateMove}
          onRotateEnd={(props as RotateProps).onRotateEnd}
        />
      )}
    </Group>
  );
}

// ─── Scale handles (4 coins) ──────────────────────────────────────────────────

function ScaleHandles({ bounds, stageScale, handleSize, hitSize, cx, cy, onScaleStart, onScaleMove, onScaleEnd }: {
  bounds: RectType; stageScale: number; handleSize: number; hitSize: number; cx: number; cy: number;
  onScaleStart: () => void; onScaleMove: (sf: number) => void; onScaleEnd: () => void;
}) {
  const origCenterRef = useRef({ x: 0, y: 0 });
  const origDistRef = useRef(0);
  const [dragCornerPos, setDragCornerPos] = useState<{ x: number; y: number } | null>(null);

  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];

  return (
    <>
      {corners.map((corner, i) => (
        <Group key={i}>
          <Rect
            x={corner.x - hitSize / 2} y={corner.y - hitSize / 2}
            width={hitSize} height={hitSize}
            fill="transparent" draggable
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
              e.target.position({ x: corner.x - hitSize / 2, y: corner.y - hitSize / 2 });
              setDragCornerPos(null);
              onScaleEnd();
            }}
          />
          <Rect
            x={corner.x - handleSize / 2} y={corner.y - handleSize / 2}
            width={handleSize} height={handleSize}
            fill="#f4a261" stroke="#fff"
            strokeWidth={1 / stageScale} cornerRadius={2 / stageScale}
            listening={false}
          />
        </Group>
      ))}

      {dragCornerPos && (
        <Line
          points={[origCenterRef.current.x, origCenterRef.current.y, dragCornerPos.x, dragCornerPos.y]}
          stroke="#f4a261" strokeWidth={1 / stageScale}
          dash={[4 / stageScale, 4 / stageScale]} opacity={0.6}
          listening={false}
        />
      )}
    </>
  );
}

// ─── Rotate handle (1 handle circulaire en haut à droite) ─────────────────────

function RotateHandle({ bounds, stageScale, hitSize, cx, cy, onRotateStart, onRotateMove, onRotateEnd }: {
  bounds: RectType; stageScale: number; handleSize: number; hitSize: number; cx: number; cy: number;
  onRotateStart: () => void; onRotateMove: (angleDeg: number) => void; onRotateEnd: () => void;
}) {
  const origAngleRef = useRef(0);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // Handle positionné au-dessus du coin top-right
  const offset = ROTATE_OFFSET / stageScale;
  const handleX = bounds.x + bounds.width;
  const handleY = bounds.y - offset;
  const handleRadius = 7 / stageScale;
  const hitRadius = hitSize / 2;

  return (
    <>
      {/* Ligne du coin top-right au handle rotate */}
      <Line
        points={[handleX, bounds.y, handleX, handleY]}
        stroke="#f4a261" strokeWidth={1.5 / stageScale}
        dash={[4 / stageScale, 3 / stageScale]}
        listening={false}
      />

      {/* Zone d'accroche invisible (cercle) */}
      <Circle
        x={handleX} y={handleY}
        radius={hitRadius}
        fill="transparent" draggable
        onDragStart={() => {
          origAngleRef.current = Math.atan2(handleY - cy, handleX - cx) * 180 / Math.PI;
          onRotateStart();
        }}
        onDragMove={(e) => {
          const node = e.target;
          const newX = node.x();
          const newY = node.y();
          const currentAngle = Math.atan2(newY - cy, newX - cx) * 180 / Math.PI;
          let delta = currentAngle - origAngleRef.current;
          // Normaliser dans [-180, 180] pour éviter les sautes à la frontière atan2
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          setDragPos({ x: newX, y: newY });
          onRotateMove(delta);
        }}
        onDragEnd={(e) => {
          e.target.position({ x: handleX, y: handleY });
          setDragPos(null);
          onRotateEnd();
        }}
      />

      {/* Cercle visible (handle rotate) */}
      <Circle
        x={dragPos?.x ?? handleX}
        y={dragPos?.y ?? handleY}
        radius={handleRadius}
        fill="#f4a261" stroke="#fff"
        strokeWidth={1 / stageScale}
        listening={false}
      />

      {/* Picto rotate — flèche circulaire simplifiée */}
      <RotateIcon x={dragPos?.x ?? handleX} y={dragPos?.y ?? handleY} stageScale={stageScale} />

      {/* Ligne du centre au handle pendant le drag */}
      {dragPos && (
        <Line
          points={[cx, cy, dragPos.x, dragPos.y]}
          stroke="#f4a261" strokeWidth={1 / stageScale}
          dash={[4 / stageScale, 4 / stageScale]} opacity={0.6}
          listening={false}
        />
      )}
    </>
  );
}

// ─── Petite icône rotate (arc + flèche) ───────────────────────────────────────

function RotateIcon({ x, y, stageScale }: { x: number; y: number; stageScale: number }) {
  // Arc de cercle simplifié avec des segments de ligne
  const r = 4 / stageScale;
  const segments = 8;
  const startAngle = -30;
  const endAngle = 210;
  const points: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (startAngle + (endAngle - startAngle) * (i / segments)) * Math.PI / 180;
    points.push(x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  // Petite flèche au bout
  const tipAngle = endAngle * Math.PI / 180;
  const tipX = x + r * Math.cos(tipAngle);
  const tipY = y + r * Math.sin(tipAngle);
  const arrowSize = 2.5 / stageScale;
  const a1 = tipAngle + 0.6;
  const a2 = tipAngle - 0.9;

  return (
    <>
      <Line
        points={points}
        stroke="#fff" strokeWidth={1.2 / stageScale}
        lineCap="round" lineJoin="round"
        listening={false}
      />
      <Line
        points={[
          tipX + arrowSize * Math.cos(a1), tipY + arrowSize * Math.sin(a1),
          tipX, tipY,
          tipX + arrowSize * Math.cos(a2), tipY + arrowSize * Math.sin(a2),
        ]}
        stroke="#fff" strokeWidth={1.2 / stageScale}
        lineCap="round" lineJoin="round"
        listening={false}
      />
    </>
  );
}
