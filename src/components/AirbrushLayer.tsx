import { useEffect, useRef } from 'react';
import { Shape } from 'react-konva';
import Konva from 'konva';
import { AirbrushStroke } from '../types';

interface OutlineProps {
  stroke: AirbrushStroke;
  color: string;
}

export function AirbrushOutline({ stroke, color }: OutlineProps) {
  const shapeRef = useRef<Konva.Shape>(null);

  useEffect(() => {
    shapeRef.current?.getLayer()?.batchDraw();
  }, [stroke, color]);

  const sceneFunc = (ctx: Konva.Context) => {
    const raw = ctx._context;
    raw.fillStyle = color;
    raw.globalAlpha = 0.45;
    for (const pt of stroke.points) {
      raw.beginPath();
      raw.arc(pt.x, pt.y, stroke.radius + 5, 0, Math.PI * 2);
      raw.fill();
    }
    raw.globalAlpha = 1;
  };

  return <Shape ref={shapeRef} sceneFunc={sceneFunc} listening={false} />;
}

interface Props {
  stroke: AirbrushStroke;
}

export function AirbrushShape({ stroke }: Props) {
  const shapeRef = useRef<Konva.Shape>(null);

  useEffect(() => {
    shapeRef.current?.getLayer()?.batchDraw();
  }, [stroke]);

  const sceneFunc = (ctx: Konva.Context) => {
    const raw = ctx._context;
    const r = parseInt(stroke.color.slice(1, 3), 16);
    const g = parseInt(stroke.color.slice(3, 5), 16);
    const b = parseInt(stroke.color.slice(5, 7), 16);

    for (const pt of stroke.points) {
      const gradient = raw.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, stroke.radius);
      gradient.addColorStop(0, `rgba(${r},${g},${b},${stroke.centerOpacity})`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},${stroke.edgeOpacity ?? 0})`);
      raw.fillStyle = gradient;
      raw.beginPath();
      raw.arc(pt.x, pt.y, stroke.radius, 0, Math.PI * 2);
      raw.fill();
    }
  };

  return <Shape ref={shapeRef} sceneFunc={sceneFunc} listening={false} />;
}
