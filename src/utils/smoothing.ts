// ─── Algorithmes de lissage temps réel pour pen/marker ───

/**
 * Moving Average — fenêtre glissante sur les N derniers points.
 * Chaque point est remplacé par la moyenne pondérée de ses voisins récents.
 * Appliqué en temps réel : on re-calcule les derniers `windowSize` points de livePoints.
 *
 * @param rawPoints  Buffer de points bruts {x,y}[] accumulés pendant le drag
 * @param windowSize Taille de la fenêtre (ex: 5 → moyenne sur 5 points)
 * @returns Flat array [x,y,x,y,...] lissé, même longueur que rawPoints
 */
export function movingAverageSmooth(
  rawPoints: Array<{ x: number; y: number }>,
  windowSize: number,
): number[] {
  const n = rawPoints.length;
  if (n === 0) return [];
  const half = Math.floor(windowSize / 2);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, count = 0;
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    for (let j = lo; j <= hi; j++) {
      sx += rawPoints[j].x;
      sy += rawPoints[j].y;
      count++;
    }
    out.push(sx / count, sy / count);
  }
  return out;
}

/**
 * Cubic Bézier smoothing — calcule des courbes de Bézier cubiques entre les points,
 * puis échantillonne le long de ces courbes pour produire un tracé lisse.
 *
 * Algorithme : tangentes moyennes (approche tldraw/Excalidraw simplifiée)
 * - Pour chaque point, on calcule la tangente comme la direction du segment précédent→suivant
 * - Les control points sont placés à ±(1/3 * distance_segment * tightness) le long de la tangente
 * - On échantillonne chaque segment de Bézier avec `samplesPerSegment` points
 *
 * @param rawPoints         Buffer de points bruts {x,y}[]
 * @param tightness         0 = anguleux (pas de lissage), 1 = très arrondi (défaut 0.5)
 * @param samplesPerSegment Nombre de points interpolés par segment (défaut 8)
 * @returns Flat array [x,y,x,y,...] de points lissés
 */
export function bezierSmooth(
  rawPoints: Array<{ x: number; y: number }>,
  tightness: number = 0.5,
  samplesPerSegment: number = 8,
): number[] {
  const n = rawPoints.length;
  if (n === 0) return [];
  if (n === 1) return [rawPoints[0].x, rawPoints[0].y];
  if (n === 2) return [rawPoints[0].x, rawPoints[0].y, rawPoints[1].x, rawPoints[1].y];

  // Calculer les tangentes pour chaque point
  const tangents: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tangents.push({ x: rawPoints[1].x - rawPoints[0].x, y: rawPoints[1].y - rawPoints[0].y });
    } else if (i === n - 1) {
      tangents.push({ x: rawPoints[n - 1].x - rawPoints[n - 2].x, y: rawPoints[n - 1].y - rawPoints[n - 2].y });
    } else {
      tangents.push({
        x: (rawPoints[i + 1].x - rawPoints[i - 1].x) / 2,
        y: (rawPoints[i + 1].y - rawPoints[i - 1].y) / 2,
      });
    }
  }

  const out: number[] = [rawPoints[0].x, rawPoints[0].y];

  for (let i = 0; i < n - 1; i++) {
    const p0 = rawPoints[i];
    const p1 = rawPoints[i + 1];
    const t0 = tangents[i];
    const t1 = tangents[i + 1];

    // Control points
    const cp1x = p0.x + t0.x * tightness / 3;
    const cp1y = p0.y + t0.y * tightness / 3;
    const cp2x = p1.x - t1.x * tightness / 3;
    const cp2y = p1.y - t1.y * tightness / 3;

    // Échantillonner le segment de Bézier cubique
    for (let s = 1; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      const x = mt2 * mt * p0.x + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t2 * t * p1.x;
      const y = mt2 * mt * p0.y + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t2 * t * p1.y;
      out.push(x, y);
    }
  }

  return out;
}
