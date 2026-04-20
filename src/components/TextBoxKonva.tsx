import React, { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import { Rect, Text, Group } from 'react-konva';
import { DrawLayer, TextLayer } from '../types';
import { TextBoxSelectionState, estimateTextHeight } from '../utils/textboxUtils';
import { ResizeHandle } from './ResizeHandle';

const HANDLE_W = 12;
const HANDLE_H = 28;
const BORDER_HIT = 14;

interface TextBoxKonvaProps {
  tb: TextLayer;
  isEditing: boolean;
  isTextSelected: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isLevel2: boolean;
  stageRef: React.RefObject<Konva.Stage>;
  textNodesRef: React.MutableRefObject<Map<string, Konva.Text>>;
  onTap: (tbId: string, tbH: number, e: Konva.KonvaEventObject<Event>) => void;
  onLayerUpdate: React.Dispatch<React.SetStateAction<DrawLayer[]>>;
  onDragEnd: () => void;
}

export const TextBoxKonva = React.memo(function TextBoxKonva({
  tb, isEditing, isTextSelected, isSelected, isFocused, isLevel2,
  stageRef, textNodesRef, onTap, onLayerUpdate, onDragEnd,
}: TextBoxKonvaProps): JSX.Element {
  // Quand isEditing passe true→false, le nœud Konva vient de repasser à text={tb.text}
  // mais height() est encore périmé (mesuré sur text=""). On force un re-render après commit.
  const prevIsEditing = useRef(isEditing);
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (prevIsEditing.current && !isEditing) forceUpdate(n => n + 1);
    prevIsEditing.current = isEditing;
  }, [isEditing]);

  const konvaNode = textNodesRef.current.get(tb.id);
  const tbH = konvaNode ? Math.max(konvaNode.height(), 20) : estimateTextHeight(tb);

  return (
    <Group id={tb.id} x={tb.x} y={tb.y} rotation={tb.rotation ?? 0}>
      {tb.background !== '' && (
        <Rect x={0} y={0} width={tb.width} height={tbH} fill={tb.background} opacity={tb.opacity} />
      )}

      <Text x={0} y={0} width={tb.width}
        ref={node => { if (node) textNodesRef.current.set(tb.id, node); else textNodesRef.current.delete(tb.id); }}
        text={isEditing ? '' : tb.text}
        fontSize={tb.fontSize} fontFamily={tb.fontFamily} fontStyle={tb.fontStyle}
        textDecoration={tb.textDecoration} align={tb.align} verticalAlign={tb.verticalAlign}
        fill={tb.color} opacity={tb.opacity} padding={tb.padding}
        lineHeight={1.4}
        wrap="word"
        listening={false}
      />

      {/* Zone intérieure principale — tap / double-tap */}
      <Rect x={0} y={0} width={tb.width} height={tbH}
        fill="rgba(0,0,0,0)"
        onClick={e => onTap(tb.id, tbH, e)}
        onTap={e => onTap(tb.id, tbH, e)}
      />

      {/* Bordure select mode (canvas selection) — orange si niveau 2 */}
      {isSelected && !isTextSelected && !isEditing && (
        <Rect x={-2} y={-2} width={tb.width + 4} height={tbH + 4}
          stroke={isLevel2 ? '#f4a261' : isFocused ? '#e63946' : '#118ab2'}
          strokeWidth={isLevel2 ? 2 : 1.5}
          dash={isLevel2 ? undefined : [5, 3]}
          fill="transparent"
          cornerRadius={3}
          listening={false}
        />
      )}

      {/* Bordure sélection text tool (pas en édition — la textarea a son propre border) */}
      {isTextSelected && !isEditing && (
        <Rect x={0} y={0} width={tb.width} height={tbH}
          stroke="#118ab2"
          strokeWidth={1.5}
          fill="transparent"
          dash={[5, 3]}
          listening={false}
        />
      )}

      {/* Bords draggables pour déplacer (seulement si sélectionnée) */}
      {isTextSelected && !isEditing && <>
        <Rect x={HANDLE_W} y={-BORDER_HIT / 2} width={tb.width - HANDLE_W * 2} height={BORDER_HIT}
          fill="transparent" draggable
          onDragMove={e => {
            const stage = stageRef.current!;
            const sc = stage.scaleX(), sp = stage.position();
            const abs = e.target.absolutePosition();
            onLayerUpdate(prev => prev.map(l => l.id !== tb.id || l.tool !== 'text' ? l : {
              ...l, x: (abs.x - sp.x) / sc - HANDLE_W, y: (abs.y - sp.y) / sc + BORDER_HIT / 2,
            }));
          }}
          onDragEnd={onDragEnd} dragBoundFunc={p => p}
        />
        <Rect x={HANDLE_W} y={tbH - BORDER_HIT / 2} width={tb.width - HANDLE_W * 2} height={BORDER_HIT}
          fill="transparent" draggable
          onDragMove={e => {
            const stage = stageRef.current!;
            const sc = stage.scaleX(), sp = stage.position();
            const abs = e.target.absolutePosition();
            onLayerUpdate(prev => prev.map(l => l.id !== tb.id || l.tool !== 'text' ? l : {
              ...l, x: (abs.x - sp.x) / sc - HANDLE_W, y: (abs.y - sp.y) / sc - tbH + BORDER_HIT / 2,
            }));
          }}
          onDragEnd={onDragEnd} dragBoundFunc={p => p}
        />
        <Rect x={-BORDER_HIT / 2} y={HANDLE_H} width={BORDER_HIT} height={tbH - HANDLE_H * 2}
          fill="transparent" draggable
          onDragMove={e => {
            const stage = stageRef.current!;
            const sc = stage.scaleX(), sp = stage.position();
            const abs = e.target.absolutePosition();
            onLayerUpdate(prev => prev.map(l => l.id !== tb.id || l.tool !== 'text' ? l : {
              ...l, x: (abs.x - sp.x) / sc + BORDER_HIT / 2, y: (abs.y - sp.y) / sc - HANDLE_H,
            }));
          }}
          onDragEnd={onDragEnd} dragBoundFunc={p => p}
        />
        <Rect x={tb.width - BORDER_HIT / 2} y={HANDLE_H} width={BORDER_HIT} height={tbH - HANDLE_H * 2}
          fill="transparent" draggable
          onDragMove={e => {
            const stage = stageRef.current!;
            const sc = stage.scaleX(), sp = stage.position();
            const abs = e.target.absolutePosition();
            onLayerUpdate(prev => prev.map(l => l.id !== tb.id || l.tool !== 'text' ? l : {
              ...l, x: (abs.x - sp.x) / sc - tb.width + BORDER_HIT / 2, y: (abs.y - sp.y) / sc - HANDLE_H,
            }));
          }}
          onDragEnd={onDragEnd} dragBoundFunc={p => p}
        />
      </>}

      {/* Handles resize milieu gauche et droit — visibles en mode texte OU select niveau 2 */}
      {(isTextSelected || isLevel2) && !isEditing && <>
        <ResizeHandle
          cx={0} cy={tbH / 2} side="left"
          tb={{ x: tb.x, y: tb.y, width: tb.width, rotation: tb.rotation }}
          stageRef={stageRef}
          onDragEnd={onDragEnd}
          onMove={(newX, newWidth) => onLayerUpdate(prev => prev.map(l =>
            l.id !== tb.id || l.tool !== 'text' ? l : { ...l, x: newX, width: newWidth },
          ))}
        />
        <ResizeHandle
          cx={tb.width} cy={tbH / 2} side="right"
          tb={{ x: tb.x, y: tb.y, width: tb.width, rotation: tb.rotation }}
          stageRef={stageRef}
          onDragEnd={onDragEnd}
          onMove={(_, newWidth) => onLayerUpdate(prev => prev.map(l =>
            l.id !== tb.id || l.tool !== 'text' ? l : { ...l, width: newWidth },
          ))}
        />
      </>}
    </Group>
  );
});
