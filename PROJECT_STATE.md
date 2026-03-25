# Tiktaalik — État du projet (2026-03-25, mis à jour session 3)

Document destiné à briefer Claude Code sur l'état actuel du projet avant de poursuivre le travail.

---

## Présentation

**Tiktaalik** est une application de sketchpad mobile-first (React + TypeScript + Konva/react-konva). Elle fonctionne dans le navigateur, stocke les données dans `localStorage`, et s'exporte en SVG.

Deux écrans :
- **GalleryScreen** — liste des dessins, création, renommage, suppression, vignettes
- **SketchScreen** — interface de dessin (canvas Konva A4 : 794×1123px)

Stack : React 18, TypeScript, Vite, react-konva, uuid

**Version actuelle : 1.3.0**

---

## Architecture actuelle

### Types fondamentaux (`src/types/index.ts`)

La pile de calques est **unifiée** depuis la refonte v1.2 → v1.3 :

```typescript
type DrawLayer = Stroke | AirbrushStroke | TextLayer
type TextLayer = TextBox & { tool: 'text' }
```

Avant cette refonte, strokes/airbrushStrokes/textBoxes étaient trois tableaux séparés. Maintenant tout est dans `Drawing.layers` en ordre chronologique = z-order réel. Migration des anciens formats gérée dans `useDrawingStorage.migrateDrawing()`.

### Canvas modes & tools

- **CanvasMode** : `draw | select | move`
- **Tool** : `pen | marker | airbrush | eraser | text | null`

Le mode et l'outil sont gérés par `useToolState` (hook, `src/hooks/useToolState.ts`). Le `ContextPanel` (`drawing | text | background | null`) contrôle quelle toolbar contextuelle est ouverte.

### TextBox state machine (`TextBoxSelectionState`)

Les textboxes ont leur propre machine d'états parallèle à `canvasMode` :
1. `idle` — aucune textbox active
2. `selected` — textbox sélectionnée (handles visibles, draggable)
3. `editing` — saisie active (textarea DOM superposée)

`editingTextId` est dérivé de `tbState.kind === 'editing' ? tbState.id : null`.
**Important** : utiliser `editingTextIdRef.current` dans les callbacks (évite les stale closures), pas `editingTextId` directement.

### Persistence

- `sketchpad_drawings` — `Drawing[]` JSON
- `sketchpad_tool_state` — couleurs et largeurs par outil

### Composants clés

| Fichier | Rôle |
|---|---|
| `src/components/SketchScreen.tsx` | Composant principal (~1140 lignes). Canvas, tous les handlers d'événements, état des layers. |
| `src/components/SelectionPanel.tsx` | Panneau horizontal de sélection (mode select). Drag-to-reorder interne avec `useDragToReorder`. |
| `src/components/AirbrushLayer.tsx` | Rendu canvas 2D des tracés airbrush via `Shape.sceneFunc`. Exporte aussi `AirbrushOutline` pour le feedback de sélection. |
| `src/components/ContextToolbar.tsx` | Toolbar contextuelle (couleurs, épaisseur, options texte). |
| `src/components/ActionFABs.tsx` | FABs flottants (save, mode select/move/draw) — disposition horizontale centrée en bas. |
| `src/hooks/useToolState.ts` | État de l'outil actif, couleurs, largeurs, persistence. |
| `src/hooks/useDragToReorder.ts` | Long-press + drag pour réordonner des éléments dans SelectionPanel. |
| `src/hooks/useDrawingStorage.ts` | CRUD localStorage + migration des anciens formats. |
| `src/utils/export.ts` | Export SVG et génération des vignettes thumbnail (canvas 2D). |

---

## Ce qui a été travaillé dans cette session (résumé des fixes et features)

### Fixes critiques résolus
- **ContextToolbar ne s'ouvrait plus** : `setContextPanel` appelé dans un `setState` updater → React StrictMode double-invocation annulait le toggle. Fix : pattern ref (`stateRef`, `contextPanelRef`) dans `useToolState`.
- **Textbox mobile non créée** : guard `pinchPendingRef` se bloquait lui-même. Fix : `pendingTextboxRef` + `handleMouseUp` pour différer la création après le touchend. Guard pinch correct via `pinchRef`.
- **Stale closure sur `editingTextId`** : tous les handlers utilisaient `editingTextId` de leur closure. Fix : `editingTextIdRef` synchronisé à chaque render.
- **Textbox non créée sur tracés existants** : guard `if (isBackground)` trop restrictif. Fix : toujours setter `pendingTextboxRef`, annuler dans `handleTap` des textboxes existantes.

### Refonte z-order (feature majeure)
- Fusion de `TextBox` dans la pile unifiée `DrawLayer` → les tracés dessinés après un texte apparaissent bien au-dessus. Migration legacy intégrée dans `useDrawingStorage`.

### Mode Select (nombreux fixes et features)

**Sélection :**
- Tap sur tracé → sélection (niveau 1). `selectItem()` sur `onClick`/`onTap` des Groups Konva.
- Tap sur airbrush : ajout d'un `Rect` hit transparent `fill="rgba(0,0,0,0)"` (Konva ne hit-teste pas `fill="transparent"`).
- Tap sur texte en mode select : `handleTap` gère le cas `canvasMode === 'select'` → `selectItem()`.
- Tracés fins : `hitStrokeWidth={Math.max(s.width, 20)}` sur les `<Line>`.

**Feedback visuel sélection :**
- Strokes sélectionnés : outline (même tracé, +6px, opacité 55%, bleu/rouge).
- Airbrush sélectionné : `AirbrushOutline` (cercles +5px radius, opacité 45%).
- Texte sélectionné en mode select : `Rect` pointillé `-2px` offset, `cornerRadius=3`.

**Déplacement (drag) en mode select :**
- Tap sur objet déjà sélectionné → `dragArmed` (seuil 6px pour éviter faux positifs).
- Objet non sélectionné → long-press 350ms → sélection + drag.
- `dragSelectionRef` stocke les ids à déplacer (évite la stale closure de `selectionRef`).
- Translation : strokes (points flat array), airbrush (points {x,y}), texte (x/y du Group).

**SelectionPanel :**
- Reorder par drag : correction direction (`orderedIds` inversé avant remplacement dans `layers`).
- Scroll horizontal : `touchAction: none` sur items + scroll manuel par delta pointermove (le navigateur ne gère pas le scroll nativement car `touchAction: none` est nécessaire pour le drag).
- Drag-to-reorder : long-press 350ms → listeners `pointermove`/`pointerup`/`pointercancel` attachés sur `document` (pas sur l'item React) pour garantir le cleanup du ghost quel que soit le contexte de re-render.
- Plus de `setPointerCapture` — le touch a un implicit capture natif suffisant.
- Boutons delete/unselect niveau 2 : `onPointerUp` + `stopPropagation` (remplace `onClick` — fiable sur mobile avec `touchAction: none`).

### Mode Texte

**Double border corrigé :** le Konva border Rect masqué quand `isEditing` (la textarea DOM a son propre border).

**Handle resize Y drift corrigé :** `lockedScreenY` ref capturé à `onDragStart`, utilisé tout au long du drag sans le recalculer sur `tbH`.

**Déplacement textbox en mode texte :** même logique drag que mode select. Si `tbState.kind === 'selected'`, tap sur la textbox → `dragArmed` → seuil 6px → déplacement. `dragSelectionRef = [tbState.id]`.

### Session 2 & 3 — features et refactoring

**FABs horizontaux :** `ActionFABs.tsx` passe de `flexDirection: 'column'` (vertical gauche) à `flexDirection: 'row'` centré en bas (`left: 50%, transform: translateX(-50%), bottom: 16`). Libère de l'espace vertical sur le canvas.

**Word wrap permanent + hauteur auto des textboxes :**
- `manualHeight` supprimé du type `TextBox` (était infrastructure planifiée, jamais branchée — toujours `undefined`)
- `wrap="word"` actif en permanence sur le `<Text>` Konva (avant : conditionnel sur `isTextSelected || manualHeight`)
- `height={tb.manualHeight}` supprimé du `<Text>` Konva — Konva calcule la hauteur librement
- `tbH = measuredH` toujours (la condition `manualHeight ? manualHeight : measuredH` était toujours falsy)
- Hauteur de la textarea DOM calculée via `scrollHeight` à chaque keystroke (`autoResizeTextarea`) → reflète le word wrap réel
- Suppression de l'auto-collapse de largeur au exit editing (`measureTextWidth` supprimée) — la largeur reste fixe
- `resolveTextBoxHeight` dans `textboxUtils.ts` nettoyée de la branche `manualHeight`

**Background par dessin (session 3) :**
- `canvasBackground` retiré de `useToolState` (était global) → champ `background: string` dans `Drawing`
- `useDrawingStorage.migrateDrawing` ajoute `background: '#ffffff'` aux anciens dessins
- `GalleryScreen.newDrawing()` inclut `background: '#ffffff'`
- `SketchScreen` gère `canvasBackground` en state local, sauvé dans le drawing
- `ContextToolbar`, `Drawingbar`, `DrawingSecondaryToolbar` reçoivent `canvasBackground` en prop

**Autosave (session 3) :**
- Debounce 4s via `useRef` timer (pas de re-render) après chaque mutation (fin de stroke, drag, blur, resize)
- Save immédiat sur `visibilitychange`, `beforeunload`, retour galerie
- `scheduleSave()` remplace tous les anciens `setIsDirty(true)`
- `saveNow()` ref-based, lit `layersRef`/`canvasBgRef`/`drawingNameRef` pour état courant
- Console log `[autosave]` à chaque save automatique

**Export clipPath (session 3) :**
- SVG : `<clipPath id="page">` + `<g clip-path="url(#page)">` autour des éléments
- Thumbnail : `ctx.rect(0, 0, w, h); ctx.clip()` avant le rendu
- Word wrap dans export SVG et thumbnails via `wrapText()` partagé

**SelectionPanel scroll + drag (session 3) :**
- Scroll horizontal : swipe rapide (mouvement > 8px avant 350ms) → scroll manuel par delta pointermove
- Drag-to-reorder : long-press 350ms → listeners `document` pour `pointermove`/`pointerup`/`pointercancel`
- Fix ghost stuck : les listeners document garantissent le cleanup quel que soit le re-render React

---

## Patterns importants à connaître

### Refs pour éviter les stale closures dans useCallback
```typescript
// Pattern systématique dans SketchScreen
const selectionRef = useRef<string[]>(selection);
selectionRef.current = selection;  // synchro à chaque render

const editingTextIdRef = useRef<string | null>(null);
editingTextIdRef.current = editingTextId;
```
Toujours utiliser le ref dans les callbacks, pas la variable d'état directement.

### Hit area Konva
- `fill="transparent"` = **pas de hit area** dans Konva.
- `fill="rgba(0,0,0,0)"` = hit area active mais visuellement transparent. ✅

### Drag shared entre select mode et text mode
Le système de drag (`dragArmed`, `isDraggingSelection`, `dragStartPos`, `dragPointerStart`, `dragLayerSnapshot`, `dragSelectionRef`) est partagé. La détection et la translation sont dans `handleMouseMove`/`handleMouseUp` **avant** les checks de mode. `dragSelectionRef` détermine quels layers bouger :
- Mode select : `selectionRef.current` (si `dragSelectionRef` est vide)
- Mode texte : `[tbState.id]` (explicitement setté dans `dragSelectionRef`)

### pendingTextboxRef (création textbox mobile)
Création différée pour éviter que le touchend du "create gesture" crée immédiatement une deuxième textbox ou blure la nouvelle :
1. `handleMouseDown` : setter `pendingTextboxRef = { x, y }`
2. `handleTap` d'une textbox existante : annuler `pendingTextboxRef = null`
3. `handleMouseUp` : créer si `pendingTextboxRef && !wasPinch`

---

## État des features par mode

### Mode Dessin (draw)
| Feature | État |
|---|---|
| Stylo (pen) | ✅ Fonctionnel |
| Marqueur (marker) | ✅ Fonctionnel |
| Aérographe (airbrush) | ✅ Fonctionnel |
| Gomme (eraser) | ✅ Fonctionnel |
| Outil texte — création | ✅ Fonctionnel (mobile + desktop) |
| Outil texte — édition inline | ✅ Fonctionnel |
| Outil texte — word wrap | ✅ Permanent, hauteur auto via scrollHeight |
| Outil texte — largeur fixe | ✅ Modifiable uniquement via handles latéraux |
| Outil texte — déplacement | ✅ Drag depuis état `selected` |
| Outil texte — resize handles | ✅ Fonctionnel (Y drift corrigé) |
| ContextToolbar drawing | ✅ Toggle au 2ème tap sur l'outil |
| ContextToolbar texte | ✅ Couleur, police, taille, alignement |
| Pinch-to-zoom | ✅ Fonctionnel |
| Annulation (undo) | ✅ Stack d'undo |
| Export SVG | ✅ Word wrap, background, clipPath A4 |
| Autosave | ✅ Debounce 4s + immédiat sur visibilitychange/beforeunload/retour galerie |

### Mode Select
| Feature | État |
|---|---|
| Tap select (stroke, airbrush, texte) | ✅ Fonctionnel |
| Rubber-band lasso | ✅ Fonctionnel |
| Feedback visuel sélection | ✅ Outline tracé / cercles airbrush / border texte |
| SelectionPanel | ✅ Vignettes, scroll horizontal (manuel), drag-to-reorder (long-press 350ms + listeners document) |
| Déplacement drag (objet sélectionné) | ✅ Seuil 6px anti-jitter |
| Déplacement long-press (non sélectionné) | ✅ 350ms |
| Reorder dans SelectionPanel | ✅ (direction corrigée) |
| Delete individuel (niveau 2) | ✅ |
| Deselect individuel (niveau 2) | ✅ |
| Delete tout | ✅ |
| Deselect tout | ✅ |

### GalleryScreen
| Feature | État |
|---|---|
| Création / ouverture | ✅ |
| Renommage | ✅ |
| Suppression | ✅ |
| Vignettes | ✅ Thumbnail généré au save (autosave inclus), clippé A4 |

---

## Dettes techniques connues

- ESLint : ~16 erreurs (unused vars, `any` types, empty catch) — non bloquant
- `react-hooks/exhaustive-deps` : plugin ESLint non installé
- `any` dans plusieurs composants (compat legacy)
- Aucun test unitaire pour les nouveaux composants (seul `textboxUtils.test.ts` existe)
- `DrawingSecondaryToolbar.tsx` : composant obsolète (remplacé par `ContextToolbar`), non supprimé

---

## Commandes utiles

```bash
npm run dev          # Dev server Vite (hot reload)
npm run build        # tsc --noEmit + vite build
npm run test         # Vitest
npx eslint src/      # Lint
```
