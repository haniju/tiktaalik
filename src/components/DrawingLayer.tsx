import React from 'react';
import Konva from 'konva';
import { Layer, Line, Rect, Group, Circle, Shape } from 'react-konva';
import { DrawLayer, Stroke, AirbrushStroke, TextLayer, CanvasMode, GridSettings } from '../types';
import { TextBoxSelectionState } from '../utils/textboxUtils';
import { AirbrushShape, AirbrushOutline } from './AirbrushLayer';
import { TextBoxKonva } from './TextBoxKonva';
import { BoundingBoxHandles } from './BoundingBoxHandles';
import { CanvasGrid } from './CanvasGrid';
import { getGroupBounds } from '../utils/bounds';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

type SelectSubMode = 'none' | 'rotate' | 'scale';

interface DrawingLayerProps {
  canvasBackground: string;
  showGrid: boolean;
  gridSettings?: GridSettings;
  debug: boolean;
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
  eraserCursorRef: React.MutableRefObject<Konva.Circle | null>;
  eraserActive: boolean;
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
  canvasBackground, showGrid, gridSettings, debug, layers, selection, focusedIds, selectSubMode, stageScale,
  tbState, canvasMode,
  currentStroke, currentAirbrush, liveLineRef, eraserCursorRef, eraserActive, selRect,
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

      {showGrid && <CanvasGrid width={A4_WIDTH} height={A4_HEIGHT} gridSettings={gridSettings} />}

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
          const tension = s.smoothingMode ? 0 : 0.3;
          return (
            <Group key={s.id} id={s.id} onClick={selectItem} onTap={selectItem}>
              {/* Outline de sélection — même tracé, plus épais, en dessous */}
              {isSelected && (
                <Line points={s.points}
                  stroke={outlineColor}
                  strokeWidth={s.width + 6}
                  lineCap="round" lineJoin="round" tension={tension}
                  opacity={0.55}
                  listening={false}
                />
              )}
              <Line points={s.points}
                stroke={s.color}
                strokeWidth={s.width} opacity={s.opacity}
                lineCap="round" lineJoin="round" tension={tension}
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
          tension={currentStroke.smoothingMode ? 0 : 0.3}
          listening={false}
        />
      )}
      {currentAirbrush && <AirbrushShape stroke={currentAirbrush} />}

      {/* Debug — points enregistrés de chaque tracé */}
      {debug && (
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            const r = 2.5 / stageScale;
            for (const layer of layers) {
              if (layer.tool === 'text') continue;
              if (layer.tool === 'airbrush') {
                const ab = layer as AirbrushStroke;
                ctx.fillStyle = 'rgba(0,180,255,0.7)';
                for (const pt of ab.points) {
                  ctx.beginPath();
                  ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                  ctx.fill();
                }
              } else {
                const s = layer as Stroke;
                ctx.fillStyle = 'rgba(255,40,40,0.7)';
                for (let i = 0; i < s.points.length - 1; i += 2) {
                  ctx.beginPath();
                  ctx.arc(s.points[i], s.points[i + 1], r, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
            }
          }}
        />
      )}

      {/* Curseur eraser — cercle montrant la zone d'effacement (rayon 20 = seuil eraseAt) */}
      {eraserActive && (
        <Circle
          ref={eraserCursorRef}
          radius={20}
          stroke="rgba(255,60,60,0.6)"
          strokeWidth={1.5 / stageScale}
          dash={[4 / stageScale, 3 / stageScale]}
          listening={false}
        />
      )}

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
