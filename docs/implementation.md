# Tiktaalik — Notes d'implémentation

Ce document décrit **comment les comportements sont implémentés** dans la stack React + TypeScript + Konva. Il est destiné aux développeurs travaillant sur ce codebase.

Pour comprendre **ce que fait l'app** (perspective utilisateur, tech-agnostique), voir `docs/behavior.md`.

---

## State & Persistence

Toutes les données vivent dans `localStorage` :
- `sketchpad_drawings` — `Drawing[]` sérialisé (layers, background, metadata)
- `sketchpad_drawing_order` — array d'IDs pour l'ordre galerie (Option A : séparé des objets Drawing, filtré au chargement)
- `sketchpad_tool_state` — réglages d'outil actifs (couleurs, épaisseurs, outil actif, canvasMode, previousMode)
- `sketchpad_button_mapping` — array `{ key, code, keyCode, label, action }` pour le mapping de boutons physiques

Hooks custom :
- `useDrawingStorage` — CRUD drawings dans localStorage, migration automatique des formats legacy
- `useToolState` — outil actif, canvasMode, couleurs, épaisseurs, opacités par outil. **`canvasBackground` n'est PAS ici** — c'est un état par-Drawing
- `useButtonMapping` — deux phases : listen mode (capture `keydown`, `preventDefault` sur tout, ajoute à la liste détectée) et active mode (listeners `keydown`/`keyup` hold-aware avec seuil 250ms). Interface `HoldAwareActions: { toggle, enter, exit }` contenant un `Record<MappableAction, () => void>`
- `useDragToReorder` — layout `'horizontal'` (SelectionPanel) et `'grid'` (HomeScreen). Long-press deux phases (`onLongPressRelease` pour sélection, move après long-press pour drag). `blockNativeScroll()` intercepte `touchmove` (non-passive) sur le scroll container
- `useDrawingOrder` — persistance de l'ordre galerie. `applyOrder()` trie, filtre les IDs périmés, place les nouveaux dessins en premier
- `useAutosave` — timer debounced, saveNow/scheduleSave, listeners visibilitychange/beforeunload
- `useUndoRedo` — undoStack, pushUndo, undo/redo, raccourci Cmd+Z
- `useStageViewport` — stageRef, stageSize, zoomPct, canvasH, centerViewOn, zoomTo. Constantes exportées : `TOPBAR_H = 48`, `DRAWINGBAR_H = 48`

## Canvas & Viewport

Canvas = `react-konva` Stage, taille fixe A4 (794x1123). Monde navigable = 3x3 A4, contraint par `clampStagePos()` (exporté de `useStageViewport.ts`).

Zoom : défaut 100%, min 10%, max 400%. Pinch-to-zoom controlé par `pinchZoomEnabledRef` passé à `useCanvasGestures`.

Pile de calques unifiée : `DrawLayer = Stroke | AirbrushStroke | TextLayer`. `AirbrushLayer.tsx` gère le rendu aérographe séparément (compositing gradient radial).

## Outils de dessin

Gestion centralisée dans `useCanvasGestures.ts` — hook ~850 lignes qui gère mouseDown/Move/Up, tap, pinch, pan, eraser, text, select, drag, scale, rotate.

Lissage : `toolSmoothings` (0-1). Stylo/marqueur : filtre de distance minimale sur les points capturés (0-12px, élimine le jitter tactile). Aérographe : pas d'interpolation plus dense (facteur 0.6→0.15, élimine les artefacts de perles).

Couleur : `UnifiedColorPicker` avec prop `mode` (`drawing` | `background` | `text`). Contient des presets swatches + `HslColorPicker` extensible (sous-composant interne).

## Système TextBox

### State machine (`TextBoxSelectionState`)

Type union : `{ kind: 'idle' } | { kind: 'selected'; id } | { kind: 'editing'; id }`. Le dragging est géré hors React state (refs uniquement — voir pattern "Ref-sync" ci-dessous).

`nextSelectionState()` dans `textboxUtils.ts` — fonction pure qui calcule le prochain état. `exitState()` pour Escape/clic dehors.

`setTbStateWithLog()` dans `SketchScreen.tsx` — wrapper qui log les transitions + met à jour le state. Exposé via `setTbStateWithLogRef` (ref stable).

`tbStateRef.current` — toujours utiliser la ref, jamais la variable state dans les closures JSX (stale sinon).

### Pitfalls Konva mobile

- **Double-fire onTap + onClick** : Konva fire les deux pour le même touch sur mobile. Guard : `if (elapsed < 80ms) return` dans `handleTapById`.
- **Tap synthétique post-drag** : Konva fire un `tap` après `touchend` même quand un drag a eu lieu. Guard : `dragJustEndedRef`.
- **Double-fire handleMouseUp + handleTapById** : les deux peuvent traiter le même touch. Guard : `mouseUpHandledTapRef` — set dans handleMouseUp, checked dans handleTapById.
- **Text-tool tap selected→editing** : `dragArmedHitId` doit être set dans mouseDown en mode texte pour que mouseUp puisse effectuer la transition `selected→editing`.
- **Text-tool tap autre TB** : `mouseUpHandledTapRef` guard dans mouseDown empêche handleTapById d'escalader `selected→editing`.

### EditingTextarea

Composant `EditingTextarea` : `<textarea>` en position fixe par-dessus le canvas.

- **Web mobile** : position fixe (left:20, top:topOffset+20). Le stage est repositionné avant le mount pour que la TB atterrisse à cette position. Évite `getBoundingClientRect()` qui capture des valeurs transitionnelles pendant l'animation du clavier.
- **PWA standalone** : utilise `getBoundingClientRect()` sur le container du stage. Détection via `window.matchMedia('(display-mode: standalone)')` au chargement du module.

### Focus viewport (repositionnement du stage au tap TB)

Position cible : écran coords (20, barsH+20). Utilise l'AABB via `getLayerBounds()` (de `bounds.ts`) qui tourne les 4 coins et prend min/max — gère les TB rotées.

**Responsabilité des entry points** : il y a 3 chemins de code qui transitionnent le tbState d'une TB vers une autre :
1. `handleMouseDown` (early-exit mode texte, ligne ~322) — quand on tape sur une autre TB en état selected
2. `handleMouseUp` (pendingTextbox hit, ligne ~530) — quand une TB existante est touchée à la création
3. `handleTapById` (Konva onTap, ligne ~765) — handler principal du tap sur un noeud TB

**Règle** : chaque chemin qui transitionne vers une autre TB **doit** repositionner le viewport. Si un guard (`mouseUpHandledTapRef`) bloque un handler en aval, le handler amont qui a posé le guard doit faire le repositionnement lui-même.

## Système de sélection

`selectionRef` / `focusedIdsRef` — deux niveaux : sélection (niveau 1) et focus (niveau 2, sous-groupe pour rotate/scale).

Drag partagé entre mode select et mode text. `dragArmed` / `dragArmedHitId` / `dragStartPos` / `dragLayerSnapshot` / `dragSelectionRef` — refs pour le système de drag.

`isDraggingSelection` — ref pour distinguer un vrai drag d'un micro-jitter (<15px de déplacement total en coords écran).

### BoundingBoxHandles

Composant Konva avec prop `mode` (`'scale' | 'rotate'`). Rect pointillé orange (bounds via `getGroupBounds`). Handles : taille fixe écran (divisée par stageScale).

- **Scale** : 4 handles aux coins, ligne diagonale centre→coin actif. Scale factor = distance(coin courant, centre) / distance(coin original, centre).
- **Rotate** : 1 handle circulaire au-dessus du coin top-right, ligne pointillée. Angle via `atan2`.

## Rotation & Scale

`bounds.ts` :
- `getLayerBounds(layer): Rect` — bounding box (stroke: min/max points ± width/2, airbrush: ± radius, text: x/y/width + hauteur via wrapText)
- `getGroupBounds(layers, ids): Rect` — bounding box englobante
- `rotatePoint(x, y, cx, cy, angleDeg)` — rotation cos/sin
- `applyScale(layer, sx, sy, cx, cy)` — strokes: points transformés `(v-c)*s+c` + width scalée ; airbrush: points + radius ; textbox: délègue à `scaleTextBox`
- `applyRotation(layer, angleDeg, cx, cy)` — strokes/airbrush: points bakés ; textbox: position tournée + rotation cumulée

`textboxUtils.ts` :
- `scaleTextBox(tb, scaleFactor, cx?, cy?)` — fontSize scalé (min 8, max 200, arrondi au relâchement via `roundTextBoxFontSize`), width scalé (min 50)
- `isPointInTextBox` — dé-rotation du point de tap dans le repère local de la TB avant test rectangulaire (hit-test TB rotées)

`useCanvasGestures.ts` — 3 handlers par mode :
- Scale : `handleScaleStart` (snapshot + centre), `handleScaleMove(sf)`, `handleScaleEnd` (arrondi fontSize + undo + save)
- Rotate : `handleRotateStart` (snapshot + centre), `handleRotateMove(angleDeg)`, `handleRotateEnd` (undo + save)

`DrawingLayer.tsx` — rend `<BoundingBoxHandles>` quand focusedIds non vide + selectSubMode match. `TextBoxKonva.tsx` — `<Group rotation={tb.rotation ?? 0}>`.

## Patterns récurrents

### Ref-sync pour closures stale

Les callbacks Konva capturent les closures au moment du bind. Pattern : `const fooRef = useRef(foo); fooRef.current = foo;` en top-level du composant/hook. Utiliser `fooRef.current` dans les callbacks au lieu de `foo`. Exemples : `tbStateRef`, `toolStateRef`, `setTbStateWithLogRef`, `centerViewOnRef`, `saveNowRef`.

### saveNowRef (ref stable pour autosave)

`useDrawingStorage` retourne un nouvel objet à chaque render (pas memoized). `saveNow` serait recréé à chaque render, ce qui annulerait le timer autosave. Fix : `saveNowRef` pointe toujours vers le `saveNow` courant. Le timer et les listeners lisent via cette ref.

### pendingTextboxRef (création différée sur mobile)

En mode texte, mouseDown ne crée pas la TB immédiatement (sinon un pinch zoom créerait une TB fantôme). La position est stockée dans `pendingTextboxRef`. La TB est créée dans mouseUp si la ref n'a pas été annulée.

### Mount guard (mountReadyRef, 300ms)

Au mount de SketchScreen, un délai de 300ms bloque tous les événements canvas (`mountReadyRef = false`). Les navigateurs mobiles émettent des événements souris synthétiques aux mêmes coordonnées après un touch (le tap sur la vignette de la galerie), ce qui créerait un trait ou une TB fantôme.

### Hit area Konva

Pour les zones d'accroche tactile, utiliser `fill="rgba(0,0,0,0)"` (pas `fill="transparent"`) sur les Rect Konva — les deux sont invisibles mais seul le premier est hit-testable.

### blockNativeScroll (interception touch-move)

Dans `useDragToReorder`, `blockNativeScroll()` intercepte `touchmove` (listener non-passive) sur le scroll container pour empêcher le navigateur de revendiquer le geste pour le scroll (ce qui déclencherait `pointercancel` et tuerait le drag).

### Konva multi-touch fix (hold-to-pan)

`getPointerPosition()` de Konva lit `evt.touches[0]` (premier touch actif sur la page). Quand un doigt est sur le FAB (hors canvas), `touches[0]` = doigt FAB (immobile) → delta ~0. Fix : `holdPanTouchId` ref stocke le `touch.identifier` du doigt canvas. `handleMouseMove` itère `evt.touches` pour trouver le touch par identifier via `getTouchScreenPos()`, bypassing Konva. Guard anti-pinch : `!holdPanActiveRef.current`.

## Build & Chunking

`manualChunks` dans `vite.config.ts` split le bundle en 3 :
- **index** (~103 kB) — code applicatif
- **vendor-react** (~130 kB) — react + react-dom
- **vendor-konva** (~304 kB) — konva + react-konva

Version : `__APP_VERSION__` (depuis package.json) et `__BUILD_TIME__` (fr-FR locale) injectés en globaux via vite.config.ts.

## Export

`src/utils/export.ts` :
- SVG : styles de traits, gradients radiaux aérographe, texte word-wrap, fond canvas. ClipPath aux bornes A4.
- Thumbnail : canvas 2D, `ctx.clip()` aux bornes A4. Largeur 400px.
- `wrapText()` dans `textboxUtils.ts` partagé entre rendu canvas, export SVG et thumbnails.

## Tests

- **Unit/integration** : Vitest avec jsdom. Setup : `src/test/setup.ts`
- **E2E** : Playwright (config : `playwright.config.ts`)
- Actuellement seul `src/utils/textboxUtils.test.ts` existe
