import { DrawLayer, Stroke, AirbrushStroke, TextLayer } from '../types';
import { wrapText, scaleTextBox } from './textboxUtils';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calcule le bounding box d'un layer individuel.
 */
export function getLayerBounds(layer: DrawLayer): Rect {
  switch (layer.tool) {
    case 'pen':
    case 'marker':
      return getStrokeBounds(layer);
    case 'airbrush':
      return getAirbrushBounds(layer);
    case 'text':
      return getTextBounds(layer);
  }
}

function getStrokeBounds(stroke: Stroke): Rect {
  const pts = stroke.points;
  if (pts.length < 2) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  const half = stroke.width / 2;

  for (let i = 0; i < pts.length; i += 2) {
    const px = pts[i];
    const py = pts[i + 1];
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  return {
    x: minX - half,
    y: minY - half,
    width: maxX - minX + stroke.width,
    height: maxY - minY + stroke.width,
  };
}

function getAirbrushBounds(ab: AirbrushStroke): Rect {
  if (ab.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const pt of ab.points) {
    if (pt.x - ab.radius < minX) minX = pt.x - ab.radius;
    if (pt.x + ab.radius > maxX) maxX = pt.x + ab.radius;
    if (pt.y - ab.radius < minY) minY = pt.y - ab.radius;
    if (pt.y + ab.radius > maxY) maxY = pt.y + ab.radius;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getTextBounds(tb: TextLayer): Rect {
  const lines = wrapText(tb.text, tb.width, tb.fontSize, tb.fontFamily, tb.fontStyle, tb.padding);
  const lineHeight = tb.fontSize * 1.2;
  const height = lines.length * lineHeight + tb.padding * 2;

  return {
    x: tb.x,
    y: tb.y,
    width: tb.width,
    height,
  };
}

/**
 * Applique un scale uniforme à un layer autour d'un centre (cx, cy).
 * sx/sy permettent un scale non-uniforme mais l'interaction actuelle passe sf, sf.
 */
export function applyScale(layer: DrawLayer, sx: number, sy: number, cx: number, cy: number): DrawLayer {
  switch (layer.tool) {
    case 'pen':
    case 'marker':
      return scaleStroke(layer, sx, sy, cx, cy);
    case 'airbrush':
      return scaleAirbrush(layer, sx, sy, cx, cy);
    case 'text':
      // Pour le texte, on utilise la moyenne de sx/sy comme facteur uniforme
      return scaleTextBox(layer, (sx + sy) / 2, cx, cy);
  }
}

function scaleStroke(s: Stroke, sx: number, sy: number, cx: number, cy: number): Stroke {
  const sf = (sx + sy) / 2;
  const newPoints = s.points.map((v, i) =>
    i % 2 === 0 ? (v - cx) * sx + cx : (v - cy) * sy + cy
  );
  return { ...s, points: newPoints, width: Math.max(1, s.width * sf) };
}

function scaleAirbrush(ab: AirbrushStroke, sx: number, sy: number, cx: number, cy: number): AirbrushStroke {
  const sf = (sx + sy) / 2;
  const newPoints = ab.points.map(pt => ({
    x: (pt.x - cx) * sx + cx,
    y: (pt.y - cy) * sy + cy,
  }));
  return { ...ab, points: newPoints, radius: Math.max(1, ab.radius * sf) };
}

/**
 * Calcule le bounding box englobant un groupe de layers (par IDs).
 */
export function getGroupBounds(layers: DrawLayer[], ids: string[]): Rect {
  const selected = layers.filter(l => ids.includes(l.id));
  if (selected.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const layer of selected) {
    const b = getLayerBounds(layer);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
