import React, { useRef, useState } from 'react';
import { Group, Rect, Line, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Rect as RectType } from '../utils/bounds';
import {
  Point, boundsCorners, oppositeCorner, halfDiagonal,
  cornerScaleFactor, centerScaleFactor,
} from '../utils/scaleHandles';

interface ScaleProps {
  bounds: RectType;
  mode: 'scale';
  stageScale: number;
  /** origin = point fixe du scale (centre pour le handle central, coin opposé pour un coin) */
  onScaleStart: (origin: { x: number; y: number }) => void;
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

// ─── Scale handles (4 coins + 1 centre) ───────────────────────────────────────
//
// - Coin  : scale uniforme ancré sur le COIN OPPOSÉ (les deux côtés adjacents
//           à ce coin opposé restent en place).
// - Centre: scale uniforme ancré sur le CENTRE de la forme.
//
// Géométrie des facteurs → `utils/scaleHandles.ts` (testée unitairement).

function ScaleHandles({ bounds, stageScale, handleSize, hitSize, cx, cy, onScaleStart, onScaleMove, onScaleEnd }: {
  bounds: RectType; stageScale: number; handleSize: number; hitSize: number; cx: number; cy: number;
  onScaleStart: (origin: { x: number; y: number }) => void; onScaleMove: (sf: number) => void; onScaleEnd: () => void;
}) {
  const originRef = useRef({ x: 0, y: 0 });
  const origDistRef = useRef(0);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const corners = boundsCorners(bounds);

  /** Câble un handle draggable : origine figée au dragStart + facteur via `factorFn`. */
  const dragProps = (
    handle: Point,
    origin: Point,
    refDist: number,
    factorFn: (pointer: Point, origin: Point, refDist: number) => number,
    half: number,
  ) => ({
    onDragStart: () => {
      originRef.current = origin;
      origDistRef.current = refDist;
      onScaleStart(origin);
    },
    onDragMove: (e: KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const pointer = { x: node.x() + half, y: node.y() + half };
      setDragPos(pointer);
      onScaleMove(factorFn(pointer, originRef.current, origDistRef.current));
    },
    onDragEnd: (e: KonvaEventObject<DragEvent>) => {
      e.target.position({ x: handle.x - half, y: handle.y - half });
      setDragPos(null);
      onScaleEnd();
    },
  });

  return (
    <>
      {corners.map((corner, i) => {
        const origin = oppositeCorner(bounds, i);
        const refDist = Math.hypot(corner.x - origin.x, corner.y - origin.y);
        return (
        <Group key={i}>
          <Rect
            x={corner.x - hitSize / 2} y={corner.y - hitSize / 2}
            width={hitSize} height={hitSize}
            fill="transparent" draggable
            {...dragProps(corner, origin, refDist, cornerScaleFactor, hitSize / 2)}
          />
          <Rect
            x={corner.x - handleSize / 2} y={corner.y - handleSize / 2}
            width={handleSize} height={handleSize}
            fill="#f4a261" stroke="#fff"
            strokeWidth={1 / stageScale} cornerRadius={2 / stageScale}
            listening={false}
          />
        </Group>
      );})}

      {/* Handle central — scale ancré sur le centre, piloté par le déplacement
          vertical (voir centerScaleFactor pour le pourquoi). */}
      <Group>
        <Rect
          x={cx - hitSize / 2} y={cy - hitSize / 2}
          width={hitSize} height={hitSize}
          fill="transparent" draggable
          {...dragProps({ x: cx, y: cy }, { x: cx, y: cy }, halfDiagonal(bounds), centerScaleFactor, hitSize / 2)}
        />
        <Circle
          x={cx} y={cy} radius={handleSize / 2}
          fill="#f4a261" stroke="#fff"
          strokeWidth={1 / stageScale}
          listening={false}
        />
      </Group>

      {dragPos && (
        <Line
          points={[originRef.current.x, originRef.current.y, dragPos.x, dragPos.y]}
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
  const dragCenterRef = useRef({ x: 0, y: 0 });
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

      {/* Zone d'accroche invisible (cercle) — x/y suit dragPos pendant le drag
           pour empêcher react-konva de reset la position quand bounds change */}
      <Circle
        x={dragPos?.x ?? handleX} y={dragPos?.y ?? handleY}
        radius={hitRadius}
        fill="transparent" draggable
        onDragStart={() => {
          dragCenterRef.current = { x: cx, y: cy };
          origAngleRef.current = Math.atan2(handleY - cy, handleX - cx) * 180 / Math.PI;
          onRotateStart();
        }}
        onDragMove={(e) => {
          const node = e.target;
          const newX = node.x();
          const newY = node.y();
          const c = dragCenterRef.current;
          const currentAngle = Math.atan2(newY - c.y, newX - c.x) * 180 / Math.PI;
          let delta = currentAngle - origAngleRef.current;
          // Normaliser dans [-180, 180] pour éviter les sautes à la frontière atan2
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;
          setDragPos({ x: newX, y: newY });
          onRotateMove(delta);
        }}
        onDragEnd={() => {
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
          points={[dragCenterRef.current.x, dragCenterRef.current.y, dragPos.x, dragPos.y]}
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
