# Tiktaalik — Notes d'implémentation

Ce document décrit **comment les comportements sont implémentés** dans la stack React + TypeScript + Konva. Il est destiné aux développeurs travaillant sur ce codebase.

Pour comprendre **ce que fait l'app** (perspective utilisateur, tech-agnostique), voir `docs/behavior.md`.

---

## Glossaire

| Terme | Définition | Technique |
|-------|-----------|-----------|
| **Canevas** | Le rectangle de dessin (défaut A4, 794×1123 px, configurable) | `CanvasConfig.canvasWidth/Height`, rendu par le `background-rect` dans `DrawingLayer` |
| **Zone monde** | L'espace navigable autour du canevas (défaut 3× canevas, configurable 1×–5×) | `getWorldBounds()` dans `utils/canvasConfig.ts`, contrainte par `clampStagePos()` |
| **Viewport** | La fenêtre visible à l'écran | Le `Stage` Konva, dimensionné par `stageSize` (= taille de la fenêtre navigateur) |

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

## Canevas & Viewport

Canevas = rectangle configurable (défaut A4, 794×1123 px), rendu par `DrawingLayer`. Zone monde = multiplicateur × canevas (défaut 3×), contrainte par `clampStagePos()` (exporté de `useStageViewport.ts`). Viewport = `react-konva` Stage, dimensionné à la fenêtre navigateur.

### Configuration canevas

`CanvasConfig` (types/index.ts) : `canvasWidth`, `canvasHeight` (px), `worldMultiplier` (1–5), `displayUnit` ('px' | 'cm'). Stocké par dessin dans `Drawing.canvasConfig` (optionnel, défaut = `DEFAULT_CANVAS_CONFIG`).

Utilitaires dans `utils/canvasConfig.ts` :
- `pxToCm(px)` / `cmToPx(cm)` — conversion à 96 DPI (`PX_PER_CM = 37.795`)
- `getWorldBounds(config)` → `{ minX, maxX, minY, maxY }` — remplace les anciennes constantes `WORLD_MIN/MAX_*`

`clampStagePos` reçoit un `WorldBounds` en paramètre. Les `worldBounds` sont dérivés de la config et passés via `worldBoundsRef` à `useCanvasGestures`.

`CanvasConfigPanel.tsx` — modale overlay avec toggle unité (px/cm), presets segmentés (A4/A3/Letter/Libre), inputs numériques largeur/hauteur, multiplicateur zone monde (boutons 1×–5×), bouton reset. Accessible depuis le dropdown Topbar (item « Format canevas »).

Zoom : défaut 100%, min 20%, max 400%. Pinch-to-zoom contrôlé par `pinchZoomEnabledRef` passé à `useCanvasGestures`.

Pile de calques unifiée : `DrawLayer = Stroke | AirbrushStroke | TextLayer | ImageLayer`. `AirbrushLayer.tsx` gère le rendu aérographe séparément (compositing gradient radial). `KonvaImage.tsx` gère le rendu des images importées (chargement dataURL → `HTMLImageElement` natif, placeholder gris pendant le chargement, rect rouge si image manquante). Le composant a `listening={false}` — la zone de hit est un `<Rect>` transparent enveloppant dans `DrawingLayer`.

### Images — sélection, manipulation, nettoyage

Dans `DrawingLayer.tsx`, chaque `ImageLayer` est enveloppé dans un `<Group>` avec `onClick`/`onTap` (même pattern que strokes/airbrush). Un `<Rect>` outline (`listening={false}`) affiche la sélection (bleu/orange/rouge selon le niveau). Un `<Rect>` transparent sert de hit-area.

Dans `useCanvasGestures.ts` :
- **Eraser guard** : `eraseAt()` filtre avec `if (layer.tool === 'image') return true;` au début — les images ne sont jamais effacées.
- **Lasso** : les images sont sélectionnées via `isRectIntersecting` (AABB), même pattern que les textboxes.
- **Drag-to-move** : `{ ...img, x: img.x + dx, y: img.y + dy }` — même pattern que le texte.

Scale et rotation sont gérés par `applyScale` / `applyRotation` dans `utils/bounds.ts` (branches `case 'image'` ajoutées à l'étape 2). Scale proportionnel forcé : `sf = (sx + sy) / 2`.

Dans `SketchScreen.tsx` :
- **Suppression** (`onDeleteItem`, `deleteSelected`) : appelle `removeImage(imageStorageKey)` pour chaque image supprimée.
- **Duplication** (`duplicateFocused`) : `loadImage(origKey)` puis `saveImage(newKey, dataUrl)` — la copie a sa propre clé storage indépendante.

Dans `SelectionPanel.tsx` : `ItemKind` étendu avec `'image'`, label « Image », icône SVG paysage (cadre + cercle + triangle).

## Grille canvas

`CanvasGrid.tsx` — un seul `Konva.Shape` avec `sceneFunc`. `listening={false}`, `React.memo`. Rendu dans `DrawingLayer` juste après le `background-rect`.

### Modes de rendu

Trois styles pilotés par `GridSettings.style` :
- **`dots`** — `fillRect` aux intersections. Points majeurs (rayon 1.5px) tous les 5×spacing. Points mineurs : rayon 0.8px.
- **`lines`** — `stroke` avec lignes verticales + horizontales. `lineWidth: 0.5`.
- **`checkerboard`** — `fillRect` en damier : cases paires en `altColor` (opacité × 0.35), cases impaires en `mainColor`.

### Couleur et opacité

La couleur est un hex (défaut `#e63946` rouge), convertie en rgba via `hexToRgba(hex, opacity)`. L'opacité (0–1) est appliquée directement dans le canal alpha. Plus de détection de luminance du fond — la couleur est choisie par l'utilisateur.

### Persistance

- `Drawing.showGrid` (booléen optionnel) — toggle visibilité, sauvegardé via `useAutosave` (`showGridRef`)
- `Drawing.gridSettings` (optionnel) — `GridSettings { style, spacing, opacity, color }`, sauvegardé via `gridSettingsRef`
- Défauts dans `DEFAULT_GRID_SETTINGS` (types/index.ts) : dots, 20px, 0.3, #e63946

### UI

`GridSettingsPanel.tsx` — modale overlay avec sélecteur segmenté (style), slider espacement + presets, slider opacité, palette 8 couleurs, bouton reset. Accessible depuis le dropdown Topbar (item « Réglages grille »).

## Outils de dessin

Gestion centralisée dans `useCanvasGestures.ts` — hook ~850 lignes qui gère mouseDown/Move/Up, tap, pinch, pan, eraser, text, select, drag, scale, rotate.

### Lissage

`toolSmoothings` (0-1 par outil). Trois modes pour stylo/marqueur, sélectionnables via `bezierSmoothing` / `movingAverageSmoothing` (booléens mutuellement exclusifs dans `ToolState`).

**Mode classique** (défaut) — filtre de distance minimale : `minDist = smoothing * 12`. Élimine les points < minDist du dernier accepté. Konva applique `tension={0.3}` (Catmull-Rom) au rendu.

**Mode Bézier** (`src/utils/smoothing.ts: bezierSmooth`) — accumule les points bruts dans `rawPointsBuffer`. À chaque `handleMouseMove`, recalcule la courbe complète :
1. Calcul des tangentes par point (moyenne des segments adjacent)
2. Control points placés à ±(tightness/3 × tangente) de chaque extrémité de segment
3. Échantillonnage de 8 points par segment de Bézier cubique (formule De Casteljau)
4. `livePointsRef` est remplacé intégralement (pas de push incrémental)

Plage réduite : `minDist = smoothing * 1.8` (100% slider = ancien 15%). Konva `tension={0}` (points déjà courbes).

**Mode moyenne glissante** (`src/utils/smoothing.ts: movingAverageSmooth`) — fenêtre symétrique de 7 points. Chaque point = moyenne de ses ±3 voisins. Même pattern que Bézier : recalcul complet de `livePointsRef` à chaque move.

Plage réduite : `minDist = smoothing * 0.84` (100% slider = ancien 7%). Konva `tension={0}`.

**Stockage** : `Stroke.smoothingMode?: 'bezier' | 'movingAverage'` — tagué à la création dans `handleMouseDown`. `DrawingLayer` lit ce champ pour choisir `tension={0}` ou `tension={0.3}`. Les strokes legacy (sans `smoothingMode`) gardent `tension={0.3}`.

**`handleMouseUp`** : recalcul final avec le dernier point brut inclus dans le buffer (évite de tronquer la fin du tracé si le filtre de distance l'avait exclu).

**Fichiers** :
| Fichier | Rôle |
|---------|------|
| `src/utils/smoothing.ts` | Algorithmes `bezierSmooth()` et `movingAverageSmooth()` |
| `src/types/index.ts` | `ToolState.bezierSmoothing`, `ToolState.movingAverageSmoothing`, `Stroke.smoothingMode` |
| `src/hooks/useToolState.ts` | Toggles radio (activer un désactive l'autre), persist localStorage |
| `src/hooks/useCanvasGestures.ts` | `rawPointsBuffer` ref, branchement algo dans handleMouseMove/Up |
| `src/components/DrawingPanel.tsx` | 3 boutons radio (Classique / Bézier / Moy. glissante) |
| `src/components/DrawingLayer.tsx` | `tension` dynamique selon `stroke.smoothingMode` |

Aérographe : inchangé — pas d'interpolation plus dense (facteur 0.6→0.15, élimine les artefacts de perles).

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
- **Text-tool selected → tap hors TB (mobile)** : sur mobile, un tap sur le Stage (zone hors shapes Konva, ex: hors de la page A4) génère un `touchstart` puis un `mousedown` synthétique ~300ms plus tard. Le premier `handleMouseDown` fait la transition `selected→idle`, le second arrive en `idle` et arme `pendingTextboxRef` → TB fantôme. Guard : `e.evt.preventDefault()` sur les événements touch dans la branche selected→exit, empêche le mousedown synthétique. Ne se produit pas quand le tap touche une shape Konva (ex: `background-rect` de la page) car Konva gère l'événement en interne.

### EditingTextarea

Composant `EditingTextarea` : `<textarea>` en position fixe par-dessus le canvas.

- **Web mobile** : position fixe (left:20, top:topOffset+20). Le stage est repositionné avant le mount pour que la TB atterrisse à cette position. Évite `getBoundingClientRect()` qui capture des valeurs transitionnelles pendant l'animation du clavier.
- **PWA standalone** : utilise `getBoundingClientRect()` sur le container du stage. Détection via `window.matchMedia('(display-mode: standalone)')` au chargement du module.

### Édition TB interrompue sur mobile (keydown intercepté par button mapping)

**Bug** : sur mobile, taper la première lettre dans une TB provoque une sortie instantanée de l'édition (`editing → idle`) et un changement de mode canvas (passage en pan/move). L'édition est perdue.

**Cause racine** : le clavier virtuel mobile envoie des `keydown` avec `key: "Unidentified"`, `code: ""`, `keyCode: 229`. L'ancien match ne comparait que `key` + `code`, donc tous les boutons physiques « Unidentified » (volume, boutons programmables) et le clavier virtuel étaient confondus.

**Fix** (`useButtonMapping.ts`) : le match utilise le triplet `key` + `code` + `keyCode`. Le `keyCode` est unique par bouton physique (ex: 174 = volume down, 175 = volume up) et le clavier virtuel a `keyCode: 229` (composition) qui ne matche aucun bouton mappé. Guard supplémentaire : si l'événement vient d'un TEXTAREA/INPUT et que `code` est vide, il est ignoré (filet de sécurité).

**Historique** :
- Le bug avait "disparu" avant l'ajout du button mapping (`feat: physical button mapping`, commit `bbac5da`) et est réapparu avec cette feature.
- Première piste (blur parasite post-onChange) : un flag synchrone `justTypedRef` dans `EditingTextarea.tsx` bloque les blurs transitoires causés par le re-render React. Ce guard reste en place comme filet de sécurité, mais il ne traitait pas la vraie cause (le keydown intercepté par le button mapping, qui appelait `exitEditing()` directement — pas via un blur).

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
- Rotate : `handleRotateStart` (snapshot + centre), `handleRotateMove(angleDeg)` (stocke aussi dans `rotateLatestRef` pour accès synchrone), `handleRotateEnd` (lit `rotateLatestRef` au lieu de `layersRef` pour éviter le stale state si React n'a pas rendu entre le dernier move et le end)

## Duplication d'objets

`duplicateFocused` dans `SketchScreen.tsx` — duplique tous les layers focusés. Deux maps d'IDs : `layerIdMap` (layer id → new id) et `groupIdMap` (group id → new id, lazy-created). Les groupIds sont remappés pour que les copies forment des groupes indépendants des originaux. Les copies sont ajoutées en fin de pile (z-index max), ajoutées à la sélection, et deviennent les nouveaux focusedIds.

**Piège rotation — react-konva reset position** : pendant un Konva drag, `setLayers` change les bounds → react-konva re-rend le Circle avec de nouveaux `x`/`y` → reset la position du nœud en plein drag. Fix : le hit Circle utilise `x={dragPos?.x ?? handleX}` pour que react-konva reçoive la position de drag courante et ne la reset pas.

`DrawingLayer.tsx` — rend `<BoundingBoxHandles>` quand focusedIds non vide + selectSubMode match. `TextBoxKonva.tsx` — `<Group rotation={tb.rotation ?? 0}>`.

### Groupement de tracés

**Modèle de données** : chaque `DrawLayer` (`Stroke`, `AirbrushStroke`, `TextBox`, `ImageLayer`) possède un champ optionnel `groupIds?: string[]`. C'est une pile hiérarchique : l'index 0 est le groupe le plus interne (créé en premier), le dernier est le plus externe (groupe parent). Un layer sans `groupIds` (ou `undefined`) n'appartient à aucun groupe.

**Utilitaires** (`src/utils/groupUtils.ts`) — fonctions pures :
- `expandToGroups(layers, ids)` — étend les IDs par le groupId le plus externe de chaque layer touché
- `createGroup(layers, memberIds, groupId)` — push le groupId dans la pile de chaque membre, rassemble en z-order contigu
- `ungroupLayers(layers, groupId)` — retire un groupId spécifique de la pile (les sous-groupes subsistent)
- `autoDissolveGroups(layers)` — dissout les groupIds qui ont < 2 membres (vérification sur tous les niveaux)
- `getGroupPanelItems(layers, selection)` → `PanelDisplayItem[]` — collapse par groupId externe en items `'single'` ou `'group'`
- `canGroup` / `canUngroup` / `getFocusedGroupId` — logique conditionnelle pour la toolbar

**Sélection atomique** (`useCanvasGestures.ts`) : `expandToGroups` est appelé dans `handleSelectItem`, `handleTapById` (textbox), lasso (`handleMouseUp`), et long-press drag. Tap sur un membre → tout le groupe externe est sélectionné.

**Gomme** : `eraseAt` applique `autoDissolveGroups` après filtrage pour dissoudre les groupes tombés < 2 membres.

**Callbacks** (`SketchScreen.tsx`) :
- `handleGroup()` — `createGroup(layers, focusedIds, uuidv4())` + pushUndo
- `handleUngroup()` — `ungroupLayers(layers, getFocusedGroupId(...))` + pushUndo
- `onFocus` — expand au groupe entier dans focusedIds
- `onDeleteItem` — expand + autoDissolve après suppression

**Panel** (`SelectionPanel.tsx`) : groupes collapsés en une vignette avec `StackedBorders` (2 divs offset en z-index négatif). Toolbar : bouton group visible si `canGroup`, ungroup si `canUngroup`. Drag-to-reorder expand les memberIds au callback.

### Synchronisation panelSelected ↔ focusedIds

Le panel de sélection maintient un état interne `panelSelected` qui contrôle la visibilité du badge bar (suppression/déselection) et le style `thumbSelected` (bordure noire). Cet état est **synchronisé automatiquement avec `focusedIds`** via un `useEffect`.

**Problème résolu** : avant le fix, sur-sélectionner un objet depuis le canvas mettait à jour `focusedIds` (contour orange sur le canvas) mais pas `panelSelected` (pas de badge bar dans le panel). L'utilisateur devait re-taper la vignette pour voir les options.

**Fix** : un `useEffect([focusedIds])` dans `SelectionPanel` recalcule `panelSelected` à partir de `focusedIds` — pour chaque item du panel, si ses membres sont tous dans `focusedIds`, il est marqué comme sélectionné dans le panel. Cela unifie les deux chemins (canvas et panel) : `handleSelect` dans le panel appelle `onFocus` → met à jour `focusedIds` → l'effect sync `panelSelected`.

### Lasso sur tracés existants

En mode select, les tracés Konva écoutent les événements (`listening={true}` par défaut + `hitStrokeWidth` 20px). Un tap sur un tracé non sélectionné atteint le `Group`'s `onClick`/`onTap` → `handleSelectItem` → ajout à la sélection. Un drag (> 8px) sur un tracé non sélectionné annule le `dragLongPressTimer` et démarre un lasso depuis la position canvas du pointer-down (`longPressCanvasPos` ref).

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

### Branding BETA conditionnel

Le branding BETA (badges, title, manifeste PWA) est piloté par la variable d'environnement `VITE_BETA=true` au moment du build — pas hardcodé dans le code source. Cela permet de merger `dev` → `main` sans que le branding beta pollue la version stable.

- `vite.config.ts` : lit `process.env.VITE_BETA`, conditionne le manifeste PWA (`name`, `short_name`) et injecte `__IS_BETA__` via `define`
- `src/main.tsx` : change `document.title` si `__IS_BETA__`
- Composants (`HomeScreen`, `AboutModal`) : affichent le badge BETA conditionnellement
- `deploy-beta.sh` : passe `VITE_BETA=true npm run build`
- `deploy.sh` : build sans variable → branding stable

### Deploy incrémental (manifeste MD5)

Les scripts de deploy utilisent un transfert incrémental basé sur les checksums MD5 pour éviter de re-transférer tous les fichiers à chaque deploy :

1. Après le build, un manifeste des checksums MD5 de tous les fichiers de `dist/` est généré
2. Ce manifeste est comparé au précédent (`.last-deploy-stable.md5` ou `.last-deploy-beta.md5`)
3. Seuls les fichiers nouveaux/modifiés sont uploadés, les fichiers supprimés sont retirés du serveur
4. Si rien n'a changé, le script s'arrête sans ouvrir de connexion FTP
5. Le manifeste est mis à jour après un deploy réussi

Au premier deploy (pas de manifeste existant), tous les fichiers sont transférés normalement.

## Import d'images

### Architecture

`ImageLayer` dans `DrawLayer[]` (pile unifiée). Les données image (dataURL JPEG) sont stockées dans des clés localStorage séparées (`img_{id}`) — le layer ne contient que la référence (`imageStorageKey`).

### Pipeline import

`src/hooks/useImageImport.ts` : `createImageBitmap(file)` (gère HEIC + corrige orientation EXIF automatiquement) → redimensionnement si > 877px (1/2 A4 à 150 DPI) → canvas offscreen → `toDataURL('image/jpeg', 0.75)` → `saveImage(key, dataUrl)` dans localStorage séparé.

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/types/index.ts` | `ImageLayer` dans `DrawLayer` union |
| `src/utils/imageStorage.ts` | CRUD localStorage (`saveImage`, `loadImage`, `removeImage`, `canStoreMore`) |
| `src/hooks/useImageImport.ts` | Pipeline import (file picker, resize, compression, layer creation) |
| `src/components/KonvaImage.tsx` | Rendu Konva (chargement dataURL → `HTMLImageElement`, placeholder gris pendant chargement, rect rouge si image manquante) |
| `src/components/ImageOpacityPanel.tsx` | Panneau flottant d'opacité pour images sélectionnées |
| `src/hooks/useCanvasGestures.ts` | Eraser guard (`if (layer.tool === 'image') return true`), lasso, drag-to-move |
| `src/utils/bounds.ts` | `applyScale` / `applyRotation` — branches `case 'image'` |

### Eraser guard

Dans `useCanvasGestures.ts`, `eraseAt()` filtre avec `if (layer.tool === 'image') return true;` — les images ne sont jamais effacées par la gomme (décision UX).

### Export d'images

`renderToCanvas()` et `exportSvg()` dans `src/utils/export.ts` gèrent le cas `layer.tool === 'image'` :

- **Raster** (`renderToCanvas`) : `new Image()` avec `src = dataUrl` (synchrone car dataURL inline, pas de fetch réseau). Applique `globalAlpha` pour l'opacité et `save/translate/rotate/restore` pour la rotation.
- **SVG** (`exportSvg`) : `<image href="${dataUrl}" .../>` — le dataURL est embarqué directement dans le SVG (data URI dans l'attribut `href`). Rotation via `transform="rotate(...)"`.
- **Thumbnail** (`generateThumbnail`) : utilise `renderToCanvas` → les images sont automatiquement incluses.
- **Impression** (`printDrawing`) : utilise `renderToCanvas` → idem.

Contrainte : `renderToCanvas` reste **synchrone** (pas d'async/await) — `new Image()` avec un dataURL est synchrone sur tous les navigateurs modernes.

## Export

`src/utils/export.ts` :
- `renderToCanvas()` : helper interne qui rend les layers sur un `<canvas>` à une résolution donnée. Factorise le code entre thumbnails et exports raster. Gère tous les types de layers (strokes, airbrush, text, image).
- `exportSvg()` : SVG vectoriel — styles de traits, gradients radiaux aérographe, texte word-wrap, images embarquées (data URI), fond canvas. ClipPath aux bornes A4.
- `exportRaster()` : PNG/JPG/WebP via `canvas.toBlob()`. Résolution native A4 (794×1123). Qualité 0.92 pour JPG/WebP.
- `printDrawing()` : ouvre une fenêtre `window.open`, écrit un document HTML minimal avec l'image PNG et déclenche `window.print()` à l'onload.
- `generateThumbnail()` : canvas 2D, `ctx.clip()` aux bornes A4. Largeur 400px. Utilise `renderToCanvas()`.
- `wrapText()` dans `textboxUtils.ts` partagé entre rendu canvas, export SVG et thumbnails.

`src/components/ExportModal.tsx` : modal de choix de format (PNG, JPG, WebP, SVG) + bouton Imprimer.

## Curseur eraser & debug points

### Curseur eraser

`eraserCursorRef` (`Konva.Circle`) dans `useCanvasGestures.ts` — même pattern que `liveLineRef` (ref impérative, update via `batchDraw()`). Position mise à jour dans `moveEraserCursor()`, appelé par `eraseAt()`.

Montage conditionnel via `eraserActive` (état React) : `true` dans `handleMouseDown` quand eraser, `false` dans `handleMouseUp`. Le `Circle` est rendu dans `DrawingLayer` avec `listening={false}`, `strokeWidth` et `dash` divisés par `stageScale` pour compenser le zoom.

### Debug points (visualisation des points enregistrés)

Un seul `Konva.Shape` avec `sceneFunc` dans `DrawingLayer`, conditionné par la prop `debug`. Itère sur tous les layers :
- Strokes (`pen`/`marker`) : points rouges (`rgba(255,40,40,0.7)`), flat array `points[i], points[i+1]`
- Airbrush : points bleus (`rgba(0,180,255,0.7)`), array `{ x, y }`

Rayon des points : `2.5 / stageScale` (constant à l'écran).

## Tests

- **Unit/integration** : Vitest avec jsdom. Setup : `src/test/setup.ts`
- **E2E** : Playwright (config : `playwright.config.ts`)
- Actuellement seul `src/utils/textboxUtils.test.ts` existe
