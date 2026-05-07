# Tiktaalik — Qualit des trac (Stroke Quality)

Ce document regroupe les optimisations apportes  la fluidit et la prcision du dessin au stylet et au doigt, en mode pen et marker.

---

## Phase 1 : Bypass React state pendant le dessin actif

### Problme

Dans `useCanvasGestures.ts`, chaque `pointermove` appelait `setCurrentStroke()`, dclenchant un cycle React complet (state update  render  commit DOM virtuel  Konva batch draw).  haute frquence (stylet  240Hz+), ce pipeline cre un goulet dtranglement visible :

- Latence perceptible entre le mouvement du stylet et le trac affich
- Points perdus entre deux frames React (le browser coalesse les PointerEvents entre deux rAF, mais React ne traitait que le dernier)
- Re-renders inutiles de `DrawingLayer` (composant `React.memo`) et de tout larbre Konva

### Solution

Architecture **hybride React + Konva impratif** :

1. **React monte le nud `<Line>`** au `mousedown` (quand `currentStroke` passe de `null`  non-null via `setCurrentStroke`). Ce render unique cre le nud Konva et branche `liveLineRef` dessus.

2. **Pendant le dessin**, tous les points passent par lAPI imprative Konva :
   ```
   livePointsRef.current.push(wx, wy);
   liveLineRef.current.points(livePointsRef.current);
   liveLineRef.current.getLayer()?.batchDraw();
   ```
   Zro `setCurrentStroke`, zro re-render React.

3. **Au `mouseup`**, le stroke est commit dans `layers` avec `livePointsRef.current` comme points finaux, puis `setCurrentStroke(null)` dmonte le nud live.

### Coalesced Events & compatibilit TouchEvent

`handleMouseMove` extrait les coordonnes cran selon le type dvnement natif :

| Type dvnement | Source des coordonnes | Contexte |
|---|---|---|
| `PointerEvent` | `getCoalescedEvents()` (4-8 pts/frame stylet) | Desktop stylet, navigateurs modernes |
| `TouchEvent` | `touches[0].clientX/clientY` | Mobile (Android/iOS) |
| `MouseEvent` | `clientX/clientY` directement | Desktop souris, fallback |

Chaque point est converti de coordonnes cran en coordonnes monde :
```ts
const wx = (clientX - stageBox.left - stagePos.x) / scale;
const wy = (clientY - stageBox.top - stagePos.y) / scale;
```

**Pitfall** : `TouchEvent` na **pas** de `clientX`/`clientY` au niveau racine (contrairement  `PointerEvent`/`MouseEvent`). Accder directement  `e.evt.clientX` sur un `TouchEvent` renvoie `undefined`  les coords deviennent `NaN`  trait invisible pendant le dessin, puis lignes droites vers (0,0) au rechargement.

Le filtre de distance minimale (smoothing) est appliqu individuellement  chaque point.

### Fichiers modifis

| Fichier | Changement |
|---------|-----------|
| `src/hooks/useCanvasGestures.ts` | `liveLineRef`, `livePointsRef`, coalesced events dans `handleMouseMove`, commit via `livePointsRef` dans `handleMouseUp` |
| `src/components/DrawingLayer.tsx` | Prop `liveLineRef`, `<Line ref={liveLineRef} points={[]} ...>` |
| `src/components/SketchScreen.tsx` | Wire `liveLineRef` du hook vers `DrawingLayer` |

### Ce qui na PAS chang

- Logique airbrush (chemin spar, son propre pattern de points)
- Logique eraser
- Logique textbox / lasso / drag / pinch zoom
- Filtre de smoothing (distance minimale) : toujours actif, appliqu par point coalesc

### Points dattention

- `liveLineRef.current` est `null` tant que React na pas rendu le `<Line>` (premier frame aprs `setCurrentStroke`). En pratique le premier `handleMouseMove` arrive toujours aprs ce render.
- Les points initiaux (`livePointsRef`) sont dupliqus dans `currentStrokeRef.current.points` pour le cas dun tap court o `handleMouseUp` arrive avant tout `handleMouseMove`.
- `listening={false}` sur la `<Line>` live vite que le trac en cours intercepte les hit-tests Konva.

---

## Amliorations futures (non implmentes)

- **Lissage Catmull-Rom / Bzier en temps rel** : remplacer `tension={0.3}` par un vrai algorithme de lissage qui calcule les control points au fur et  mesure
- **Simplification Douglas-Peucker au commit** : rduire le nombre de points stocks sans perte de qualit visuelle
- **Pressure sensitivity** : exploiter `PointerEvent.pressure` pour moduler `strokeWidth` en temps rel
- **Predictive stroke** : afficher un segment prdictif bas sur la vlocit/direction pour rduire la latence perue
