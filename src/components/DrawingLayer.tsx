import React from 'react';
import Konva from 'konva';
import { Layer, Line, Rect, Group } from 'react-konva';
import { DrawLayer, Stroke, AirbrushStroke, TextLayer, CanvasMode } from '../types';
import { TextBoxSelectionState } from '../utils/textboxUtils';
import { AirbrushShape, AirbrushOutline } from './AirbrushLayer';
import { TextBoxKonva } from './TextBoxKonva';
import { BoundingBoxHandles } from './BoundingBoxHandles';
import { getGroupBounds } from '../utils/bounds';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

type SelectSubMode = 'none' | 'rotate' | 'scale';

interface DrawingLayerProps {
  canvasBackground: string;
  layers: DrawLayer[];
  selection: string[];
  focusedIds: string[];
  selectSubMode: SelectSubMode;
  stageScale: number;
  tbState: TextBoxSelectionState;
  canvasMode: CanvasMode;
  currentStroke: Stroke | null;
  currentAirbrush: AirbrushStroke | null;
  liveLineRef: React.MutableRefObject<Konva.Line | null>;
  selRect: { x: number; y: number; w: number; h: number } | null;
  stageRef: React.RefObject<Konva.Stage>;
  textNodesRef: React.MutableRefObject<Map<string, Konva.Text>>;
  onSelectItem: (id: string) => void;
  onTapById: (tbId: string, tbH: number, e: Konva.KonvaEventObject<Event>) => void;
  onLayerUpdate: React.Dispatch<React.SetStateAction<DrawLayer[]>>;
  onDragEnd: () => void;
  onScaleStart: () => void;
  onScaleMove: (scaleFactor: number) => void;
  onScaleEnd: () => void;
  onRotateStart: () => void;
  onRotateMove: (angleDeg: number) => void;
  onRotateEnd: () => void;
}

export const DrawingLayer = React.memo(function DrawingLayer({
  canvasBackground, layers, selection, focusedIds, selectSubMode, stageScale,
  tbState, canvasMode,
  currentStroke, currentAirbrush, liveLineRef, selRect,
  stageRef, textNodesRef,
  onSelectItem, onTapById, onLayerUpdate, onDragEnd,
  onScaleStart, onScaleMove, onScaleEnd,
  onRotateStart, onRotateMove, onRotateEnd,
}: DrawingLayerProps): JSX.Element {
  // Bounds pour les handles (scale/rotate) — calculé seulement quand nécessaire
  const showHandles = (selectSubMode === 'scale' || selectSubMode === 'rotate') && focusedIds.length > 0;
  const handleBounds = showHandles ? getGroupBounds(layers, focusedIds) : null;
  return (
    <Layer>
      <Rect x={0} y={0} width={A4_WIDTH} height={A4_HEIGHT} name="background-rect" fill={canvasBackground} shadowBlur={16} shadowColor="rgba(0,0,0,0.15)" />

      {/* Pile unifiée — ordre chronologique = z-index réel (tracés + textboxes) */}
      {layers.map(layer => {
        const isSelected = selection.includes(layer.id);
        const isFocused = tbState.kind !== 'idle' && tbState.id === layer.id;
        const isLevel2 = isSelected && focusedIds.includes(layer.id);
        const outlineColor = isFocused ? '#e63946' : isLevel2 ? '#f4a261' : '#118ab2';
        const selectItem = () => { if (canvasMode === 'select') onSelectItem(layer.id); };

        if (layer.tool === 'text') {
          const tb = layer as TextLayer;
          return (
            <TextBoxKonva
              key={tb.id} tb={tb}
              isEditing={tbState.kind === 'editing' && tbState.id === tb.id}
              isTextSelected={tbState.kind === 'selected' && tbState.id === tb.id}
              isSelected={isSelected}
              isFocused={isFocused}
              isLevel2={isLevel2}
              stageRef={stageRef}
              textNodesRef={textNodesRef}
              onTap={onTapById}
              onLayerUpdate={onLayerUpdate}
              onDragEnd={onDragEnd}
            />
          );
        }

        if (layer.tool === 'airbrush') {
          const ab = layer as AirbrushStroke;
          const xs = ab.points.map(p => p.x), ys = ab.points.map(p => p.y);
          const minX = Math.min(...xs) - ab.radius, minY = Math.min(...ys) - ab.radius;
          const abW = Math.max(...xs) + ab.radius - minX;
          const abH = Math.max(...ys) + ab.radius - minY;
          return (
            <Group key={ab.id} id={ab.id} onClick={selectItem} onTap={selectItem}>
              {/* Outline de sélection — cercles plus larges en dessous */}
              {isSelected && (
                <AirbrushOutline stroke={ab} color={outlineColor} />
              )}
              <AirbrushShape stroke={ab} />
              {/* Zone de hit transparente — AirbrushShape a listening={false} */}
              <Rect x={minX} y={minY} width={abW} height={abH} fill="rgba(0,0,0,0)" />
            </Group>
          );
        } else {
          const s = layer as Stroke;
          return (
            <Group key={s.id} id={s.id} onClick={selectItem} onTap={selectItem}>
              {/* Outline de sélection — même tracé, plus épais, en dessous */}
              {isSelected && (
                <Line points={s.points}
                  stroke={outlineColor}
                  strokeWidth={s.width + 6}
                  lineCap="round" lineJoin="round" tension={0.3}
                  opacity={0.55}
                  listening={false}
                />
              )}
              <Line points={s.points}
                stroke={s.color}
                strokeWidth={s.width} opacity={s.opacity}
                lineCap="round" lineJoin="round" tension={0.3}
                hitStrokeWidth={Math.max(s.width, 20)}
              />
            </Group>
          );
        }
      })}

      {/* Tracé en cours — React monte le nœud, Konva le met à jour via liveLineRef (zéro re-render) */}
      {currentStroke && (
        <Line
          ref={liveLineRef}
          points={[]}
          stroke={currentStroke.color}
          strokeWidth={currentStroke.width}
          opacity={currentStroke.opacity}
          lineCap="round"
          lineJoin="round"
          tension={0.3}
          listening={false}
        />
      )}
      {currentAirbrush && <AirbrushShape stroke={currentAirbrush} />}

      {/* Bounding box + handles scale/rotate */}
      {showHandles && handleBounds && handleBounds.width > 0 && selectSubMode === 'scale' && (
        <BoundingBoxHandles
          bounds={handleBounds}
          mode="scale"
          stageScale={stageScale}
          onScaleStart={onScaleStart}
          onScaleMove={onScaleMove}
          onScaleEnd={onScaleEnd}
        />
      )}
      {showHandles && handleBounds && handleBounds.width > 0 && selectSubMode === 'rotate' && (
        <BoundingBoxHandles
          bounds={handleBounds}
          mode="rotate"
          stageScale={stageScale}
          onRotateStart={onRotateStart}
          onRotateMove={onRotateMove}
          onRotateEnd={onRotateEnd}
        />
      )}

      {selRect && selRect.w > 0 && <Rect x={selRect.x} y={selRect.y} width={selRect.w} height={selRect.h} stroke="#118ab2" strokeWidth={1} dash={[6, 3]} fill="rgba(17,138,178,0.06)" />}
    </Layer>
  );
});
