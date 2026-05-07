# Tiktaalik — Spécifications comportementales

Ce document décrit **ce que fait l'application** du point de vue de l'utilisateur. Il est volontairement agnostique de la stack technique (pas de noms de composants, hooks, refs ou fichiers). Il sert de référence pour un PO, un designer ou un portage vers une autre technologie.

---

## HomeScreen

### Galerie

L'écran d'accueil affiche une grille flex-wrap de vignettes (2 colonnes). Chaque vignette montre une miniature du dessin et un pied de page (titre | horodatage). La galerie est scrollable verticalement.

Les dessins apparaissent dans un ordre personnalisable (voir Réordonnancement). Les nouveaux dessins apparaissent en premier.

### Sélection & réordonnancement des vignettes

- **Appui long** sur une vignette : la sélectionne (vibration de confirmation). Une barre d'actions apparaît (supprimer, renommer).
- **Appui long + glisser** : réordonne la vignette par drag-and-drop dans la grille. Un fantôme flottant suit le doigt. L'auto-scroll vertical s'active quand le doigt approche les bords.
- **Multi-sélection** : une fois le mode sélection activé (par appui long), taper sur d'autres vignettes les ajoute/retire de la sélection.
- Le menu contextuel natif (long-press popup du navigateur) est bloqué sur les vignettes.
- L'ordre personnalisé est persisté indépendamment des données de dessin (survit à la création/suppression).

### Création / Suppression / Renommage

- **Création** : bouton dédié, crée un dessin vierge.
- **Suppression** : via la barre d'actions en mode sélection. Boîte de confirmation avant suppression.
- **Renommage** : via la barre d'actions en mode sélection. Popup de saisie du nouveau nom. En mode dessin, le titre dans la barre supérieure est aussi éditable au tap (inline).

### Version & mise à jour

Un badge en bas affiche la version de l'app et l'horodatage du dernier build.

Un bouton d'installation PWA est disponible quand l'app est éligible.

---

## SketchScreen

### Canvas

Le canvas a une taille fixe A4 (794 x 1123 px). Le monde navigable est 3x3 A4 (une page de marge de chaque côté). L'utilisateur ne peut pas naviguer au-delà.

Les données de dessin sont une pile unifiée de calques (ordre chronologique = ordre z). Chaque dessin a une couleur de fond indépendante.

Types de calques :
- **Trait** (stylo, marqueur)
- **Aérographe** (gradient radial)
- **Textbox** (texte éditable avec position, dimensions, rotation)

### Outils de dessin (stylo, marqueur, aérographe, gomme)

Cinq outils disponibles : stylo, marqueur, aérographe, gomme, texte. La sélection d'outil se fait dans la barre d'outils.

Chaque outil a ses propres réglages persistés entre sessions :
- **Couleur** : palette de presets + sélecteur HSL extensible. Palette vive pour dessin/texte, palette neutre pour le fond.
- **Épaisseur** : slider par outil.
- **Opacité** : slider pour le marqueur et l'aérographe (centre + bord séparés pour l'aérographe).
- **Lissage** : slider par outil de dessin (0-100%). Réduit le tremblement tactile pour stylo/marqueur, élimine les artefacts de perles pour l'aérographe. Défauts : stylo/marqueur 30%, aérographe 50%.

**Sélecteur de couleur unifié** : le même composant sert pour la couleur de dessin, la couleur de fond et la couleur de texte, avec des palettes de presets adaptées au contexte.

### Outil texte

#### États d'une textbox (idle / selected / editing / dragging)

Chaque textbox suit quatre états canoniques :
1. **idle** — aucune textbox sélectionnée
2. **selected** — textbox sélectionnée, poignées visibles (redimensionnement, bordures)
3. **editing** — édition inline du texte active (textarea visible)
4. **dragging** — la textbox est en cours de déplacement

Transitions :
- **idle → selected** : tap sur une textbox
- **selected → editing** : 2e tap sur la même textbox (ou double-tap)
- **selected → selected (autre)** : tap sur une autre textbox
- **editing → selected (autre)** : tap sur une autre textbox (sort de l'édition de la première)
- **editing → selected** : tap dans le vide ou perte de focus
- **selected → idle** : tap dans le vide
- **editing → idle** : Escape ou tap dans le vide (les textboxes vides sont supprimées automatiquement)

Création de textbox : en outil texte, tap dans le vide crée une nouvelle textbox à cet endroit et passe directement en mode editing.

**Duplication** : un bouton dans le panneau texte copie la textbox sélectionnée 20px au-dessus, même X. La copie devient la textbox sélectionnée.

#### Options texte

Le panneau texte offre : police, taille (stepper +/- et saisie), gras/italique/souligné, alignement, sélecteur de couleur (masqué par défaut, toggle via icône).

#### Focus viewport au tap sur une textbox

Quand une textbox est sélectionnée ou passe en édition, le viewport se repositionne pour que la textbox apparaisse en haut à gauche de la zone visible. Pour les textboxes rotées, c'est la **boîte englobante alignée aux axes** (AABB) qui est utilisée — pas le point d'ancrage brut — pour garantir que tout le texte visible est dans la zone de focus.

#### Transfert de focus TB vers TB

Quand l'utilisateur tape sur une TBb alors qu'une TBa est déjà sélectionnée (ou en édition), le viewport **doit** se repositionner sur TBb. Le focus ne doit jamais rester sur TBa. Cette règle s'applique à tous les chemins de transition entre textboxes.

#### Édition texte (textarea)

L'édition utilise une textarea HTML positionnée par-dessus le canvas. En contexte web mobile, la position est fixe. En contexte PWA standalone, la position utilise les coordonnées réelles du conteneur canvas.

Limitation connue : un pinch zoom pendant l'édition active sort du mode editing.

#### Redimensionnement

Deux poignées (gauche/droite) permettent de redimensionner la textbox horizontalement. Largeur minimum : 150px. Pendant le drag, la poignée visible reste accrochée au bord de la textbox (seule la zone d'accroche invisible suit le doigt).

### Modes (draw / select / move)

Trois modes de canvas :
- **draw** — mode dessin (outil actif)
- **select** — mode sélection (lasso rectangulaire, sélection d'objets)
- **move** — mode panoramique (déplacement du viewport)

#### Mode pan — deux modalités d'activation

Le mode pan (move) permet de déplacer le viewport par drag sur le canvas. Deux façons de l'activer :

**1. Pan comme outil permanent (toggle)**
- Sélectionner le pan via le bouton FAB ou un bouton physique mappé (tap court <250ms) bascule en mode move.
- Un second tap (ou la sélection d'un autre outil/mode) quitte le pan.
- Entrer en pan permanent **efface** la sélection en cours et réinitialise le sous-mode select.

**2. Pan momentané / flash (hold-to-pan)**
- Maintenir le bouton FAB ou un bouton physique mappé (>=250ms) active le pan immédiatement.
- Relâcher le bouton restaure le mode et l'outil précédents.
- Si l'utilisateur était en mode select avec des objets sélectionnés, la sélection est **conservée** pendant le pan flash — y compris le sous-mode actif (rotate, scale) et les objets focusés. Au relâchement, l'utilisateur retrouve sa sélection et son sous-mode intacts.
- Si l'utilisateur était en mode draw ou sans sélection active, le comportement est identique au pan permanent (reset).

#### Mémoire du mode pan

Quand l'utilisateur entre en mode pan (move), le mode et l'outil précédents sont mémorisés. Désactiver le pan (toggle off) restaure le contexte sauvegardé. Choisir explicitement un autre mode ou outil efface la mémoire — le choix explicite a priorité.

### Sélection

#### Sélection simple / multi-sélection

En mode select :
- **Lasso rectangulaire** : tracer un rectangle sur le canvas pour sélectionner les objets qu'il intersecte (traits, aérographes, textboxes). Le lasso peut démarrer n'importe où, y compris sur un tracé existant (un drag sur un objet non sélectionné déclenche le lasso ; un tap simple le sélectionne).
- **Tap sur un objet** non sélectionné : l'ajoute à la sélection.
- **Tap sur un objet** déjà sélectionné : toggle dans le sous-groupe focus (niveau 2).
- **Tap sur le fond** : désélectionne tout.

Un panneau de sélection affiche la liste des objets sélectionnés avec label descriptif, vignette, et actions par item (supprimer, retirer de la sélection). Toolbar en haut, de gauche à droite : supprimer tout, [spacer], group/ungroup + rotate/scale (visibles seulement quand des items sont focusés), select-all / unselect-all, compteur.

**Select-all / Unselect-all** : un bouton bascule entre deux états :
- Quand tous les items ne sont pas focusés → icône « select-all » (double checkmark) : focalise tous les items de la sélection (passage en niveau 2).
- Quand tous les items sont focusés → icône « unselect-all » (cercle X) : défocalise tout (retour en niveau 1).

#### Déplacement par drag

Les objets sélectionnés sont déplaçables par drag :
- Objets déjà sélectionnés : drag immédiat.
- Objets non sélectionnés : appui long (350ms) pour sélectionner puis déplacer.
- Micro-jitter (<15px de déplacement total) est traité comme un tap, pas un drag.

#### Rotation & mise à l'échelle

En mode select, deux sous-modes disponibles via la toolbar du panneau sélection :

**Scale** :
- Boîte englobante pointillée orange autour des objets focusés.
- 4 poignées aux coins. Drag d'une poignée = scale proportionnel (facteur = distance au centre).
- Ligne indicatrice centre → coin actif pendant le drag.
- Textboxes : la taille de police et la largeur sont scalées proportionnellement (police min 8, max 200, arrondie à l'entier au relâchement).

**Rotate** :
- 1 poignée circulaire au-dessus du coin haut-droit avec ligne pointillée de liaison.
- Drag = rotation libre autour du centre du groupe.
- Traits et aérographes : les points sont recalculés (rotation définitive). Textboxes : l'angle de rotation est cumulé sur l'objet.

#### Groupement de tracés

Les objets focusés (sous-sélection) peuvent être regroupés en un **groupe persistant** :

**Créer un groupe** :
- Sélectionner ≥ 2 objets sur le canvas, puis les focuser (tap dans le panel ou tap sur le canvas).
- Un bouton « Grouper » (icône deux carrés superposés) apparaît dans la toolbar du panel.
- Le tap crée le groupe : les membres sont rassemblés en z-order contigu.

**Comportement des groupes** :
- Un groupe est **atomique** sur le canvas : tap sur un membre → tout le groupe est sélectionné.
- Le lasso sélectionne automatiquement tous les membres d'un groupe touché.
- Drag, rotation, scale s'appliquent à l'ensemble du groupe.
- Dans le panel de sélection, un groupe apparaît comme une **seule vignette** avec un effet de bordures empilées (pile de cartes).
- Le label affiché est « Groupe ».

**Groupes imbriqués** :
- On peut sélectionner plusieurs groupes existants et les regrouper en un groupe parent.
- Chaque layer maintient une pile de groupIds (innermost → outermost).
- Le dégroupement ne retire que le niveau le plus externe : les groupes enfants subsistent.

**Dégrouper** :
- Quand tous les focusedIds appartiennent au même groupe externe, un bouton « Dégrouper » (icône carrés séparés) remplace le bouton « Grouper ».
- Le tap ne dissout que le groupe externe : les sous-groupes restent intacts.

**Suppression / gomme** :
- Supprimer un groupe via le panel supprime tous ses membres.
- Si la gomme efface un membre individuel et que le groupe tombe à < 2 membres, le groupe est automatiquement dissout.

### Panneaux & barres d'outils

#### Barre d'outils de dessin (Drawingbar)

Barre supérieure sous la topbar. Icônes par outil. Gestes swipe :
- **Swipe vers le bas** sur une icône : ouvre le panneau de l'outil + sélectionne l'outil.
- **Swipe vers le haut** : ferme le panneau (fonctionne aussi sur la surface de la barre contextuelle).
- Un tap normal sélectionne l'outil sans ouvrir le panneau.

#### Barre contextuelle

Affiche des options contextuelles selon l'outil/mode actif. Animation slide pour l'ouverture/fermeture. Une zone d'accroche invisible (60px sous la barre) capture les touches pour éviter les traits accidentels sur le canvas.

#### Panneau dessin / Panneau texte

Les panneaux affichent les options de l'outil sélectionné (couleur, épaisseur, opacité, lissage pour le dessin ; police, taille, style, alignement, couleur pour le texte).

### Zoom & Viewport

Zoom par défaut : 100%. Min : 10%, max : 400%. Slider de zoom intégré dans la barre du bas avec boutons +/- et label flottant du pourcentage (timeout 5s).

Le pan et le zoom sont contraints au monde 3x3 A4 (pas de défilement infini).

**Pinch-to-zoom** (geste deux doigts) : disponible mais désactivé par défaut (toggle dans le menu déroulant de la topbar).

### Export (SVG + Vignette)

- **SVG** : export complet avec styles de traits, gradients radiaux (aérographe), texte avec retour à la ligne, couleur de fond. Clippé aux bornes A4 (pas de débordement).
- **Vignette** : rendu canvas 2D pour les previews de la galerie (400px de large). Également clippée aux bornes A4.
- Le calcul de retour à la ligne du texte est partagé entre le rendu canvas, l'export SVG et la génération de vignettes.

### Sauvegarde automatique

Timer debounced de 4 secondes après chaque mutation. Sauvegarde immédiate sur :
- Mise en arrière-plan de l'app (visibilitychange)
- Fermeture de la page (beforeunload)
- Retour à la galerie

Un bouton de sauvegarde manuelle reste disponible en fallback.

### Mapping de boutons physiques

Système de mapping de boutons physiques vers des actions de l'app. Destiné aux téléphones durcis Android (Blackview etc.) avec boutons programmables.

- **Configuration** : modale accessible depuis le menu de la topbar. Phase détection (capturer les pressions de touches) puis assignation d'action via un sélecteur.
- **Actions disponibles** : toggle pan (extensible).
- **Hold-to-pan** : les boutons physiques mappés supportent le même geste hold-to-pan que le bouton FAB (tap court = toggle, appui long = pan momentané).
- Le comportement natif des touches mappées (volume, etc.) est bloqué.
- Persisté entre sessions.

### Persistance des réglages

Tous les réglages d'outils (couleurs, épaisseurs, opacités, lissage, mode canvas, outil actif, mapping de boutons) sont persistés en localStorage et restaurés au chargement — y compris l'outil texte. Au lancement d'un dessin, un délai de 300ms bloque les interactions canvas pour éviter les interactions fantômes issues du tap sur la vignette (les navigateurs mobiles émettent des événements souris synthétiques aux mêmes coordonnées après un touch).
