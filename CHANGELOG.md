# Changelog

## v2.0.0 (2026-04-24)

Version majeure — lissage configurable, rotation/scale, gestion galerie, hold-to-pan, mapping boutons physiques.

### Lissage des tracés (nouveau)

- **Slider "Lissage"** dans le DrawingPanel de chaque outil (pen, marker, airbrush), 0–100%
- **Pen / Marker** : filtre de distance minimale sur les points capturés — élimine le micro-jitter tactile. Le seuil va de 0px (brut) à 12px (très lisse). Le dernier point brut est toujours ajouté en fin de trait pour éviter la troncature
- **Airbrush** : densité de pas d'interpolation accrue — le facteur de pas passe de 0.6 (défaut ancien) à 0.15 (lissage max), les cercles radiaux se chevauchent davantage → apparence continue, plus d'effet "collier de perles"
- **Défauts** : pen/marker 30%, airbrush 50%
- Persisté dans `localStorage` (`toolSmoothings` dans `ToolState`)
- Fix : tap court pen/marker affiche maintenant un point (micro-offset 0.1px)

### Rotate & Scale

- **Sélection à deux niveaux** : niveau 1 (sélection) + niveau 2 (focus) avec sous-modes rotate/scale
- **Scale** : bounding box pointillée + 4 handles aux coins, scale proportionnel via distance au centre
- **Rotate** : handle circulaire au-dessus du coin top-right, rotation libre, calcul via `atan2`
- `applyScale` / `applyRotation` dans `bounds.ts` — transforment strokes, airbrush et textboxes
- `TextBox.rotation` : champ optionnel, rendu via `<Group rotation>` dans Konva
- `isPointInTextBox` : dé-rotation du point de tap pour les TB rotées
- `scaleTextBox` : fontSize scalée (min 8, max 200), arrondi entier au relâchement
- `BoundingBoxHandles` : composant Konva avec mode `scale` | `rotate`, handles taille fixe écran
- `getLayerBounds` / `getGroupBounds` : calcul de bounding box pour layers
- `focusedId` → `focusedIds[]` : multi-objets dans le sous-groupe
- `ResizeHandle` refonte : knob visible 10px + hit zone invisible 30px, knob ancré au bord TB pendant le drag

### HomeScreen — Galerie

- **Drag-to-reorder** des vignettes (long-press + drag) dans la grille 2 colonnes
- **Sélection multi** avec badge bar (delete + rename)
- **Rename dialog** (popup) et confirmation de suppression
- `useDragToReorder` : layout grid 2D, long-press deux phases (`onLongPressRelease`), auto-scroll vertical, `blockNativeScroll` pour éviter le conflit scroll/drag
- `useDrawingOrder` : persistance de l'ordre personnalisé dans `sketchpad_drawing_order` (Option A : tableau d'IDs séparé)
- Vignettes : thumbnail 400px, hauteur 28vh, `onContextMenu` preventDefault, `WebkitTouchCallout: none`
- Build timestamp affiché (`__BUILD_TIME__`)
- Terminologie : Home (topbar + galerie), Galerie (zone flex-wrap), Vignette (thumbnail + footer)

### Pan mode & Hold-to-pan

- **Pan mode memory** : entrer en pan sauve `{ canvasMode, activeTool }` dans `previousMode`. Toggle off restaure le contexte. Choix explicite d'un autre mode/outil efface la mémoire
- **Hold-to-pan (pan momentané)** : maintenir le FAB pan ou un bouton physique ≥250ms active le pan immédiatement, relâcher restaure le mode précédent
- Fix : bypass de `Konva.getPointerPosition()` en multi-touch (doigt A sur FAB, doigt B sur canvas) — tracking du touch identifier via `holdPanTouchId`

### Mapping boutons physiques

- `useButtonMapping` : système deux phases — mode écoute (détection `keydown`) + mode actif (listeners hold-aware `keydown`/`keyup` avec seuil 250ms)
- `HoldAwareActions` : `{ toggle, enter, exit }` × `Record<MappableAction, () => void>`
- `ButtonMappingModal` : UI accessible depuis le dropdown Topbar "Mapping boutons"
- Actions : `toggle_pan` (extensible)
- Persisté dans `sketchpad_button_mapping`
- Conçu pour téléphones Android ruggés (Blackview etc.) avec touches programmables

### UnifiedColorPicker

- Composant unique `UnifiedColorPicker` avec prop `mode` (`drawing` | `background` | `text`)
- Remplace `ColorPickerPanel` (supprimé) et les sélecteurs inline
- Presets swatches + `HslColorPicker` HSL expandable
- TextPanel : toggle via bouton `text_color` (masqué par défaut)

### TextPanel

- Bouton **duplicate** : copie la TB sélectionnée 20px au-dessus
- TextPanel : color picker toggle via bouton icône `text_color`
- Stepper +/− pour la taille de police

### Autres améliorations

- Bundle splitté en 3 chunks (index ~107kB, vendor-react ~130kB, vendor-konva ~304kB)
- Debug overlay : pointers A/B, holdPan status
- ContextToolbar : hit area 60px invisible sous la toolbar pour capturer le swipe up
- Swipe gestures sur Drawingbar : swipe ↓ ouvre panel + switch outil, swipe ↑ ferme

### Bug fixes

- Autosave : `saveNowRef` pattern — timer plus annulé à chaque render
- ResizeHandle : clamping X minimum 150px, bord droit fixe côté gauche
- TextBox double-fire : guards `mouseUpHandledTapRef`, `dragJustEndedRef`, elapsed < 80ms
- `handleTap` : `tbStateRef.current` au lieu de closure stale
- EditingTextarea : position fixe web (left:20, top:topOffset+20), `getBoundingClientRect` en PWA standalone
- HslColorPicker : centrage thumb corrigé
- Text-tool `selected→editing` : `dragArmedHitId` armé en text-mode mouseDown
- Rotate : discontinuité `atan2` + projection resize pour TB rotées
- TB rotées : pivot de rotation corrigé (bounds, rotate, hit-test)

---

## v1.9.1 (2026-04-16)

- Bump version, renommage GalleryScreen → HomeScreen
- Terminologie Home/Galerie/Vignette

## v1.9.0

- UnifiedColorPicker initial
- Nouveaux pictos

## v1.5.0 → v1.8.3

- Voir historique git pour les détails de chaque version intermédiaire
