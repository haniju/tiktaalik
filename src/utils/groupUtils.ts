import { DrawLayer } from '../types';

// --- Types pour le panel ---

export type PanelDisplayItem =
  | { type: 'single'; id: string; layer: DrawLayer }
  | { type: 'group'; groupId: string; memberIds: string[]; topLayer: DrawLayer };

// --- Helpers internes ---

/** Retourne le groupId le plus externe (dernier dans la pile) d'un layer, ou undefined */
function outermostGroupId(layer: DrawLayer): string | undefined {
  const gids = layer.groupIds;
  return gids && gids.length > 0 ? gids[gids.length - 1] : undefined;
}

/** Vérifie si un layer appartient à un groupId donné (à n'importe quel niveau) */
function hasGroupId(layer: DrawLayer, groupId: string): boolean {
  return layer.groupIds?.includes(groupId) ?? false;
}

// --- Fonctions pures ---

/**
 * Étend un ensemble d'IDs pour inclure tous les membres des groupes touchés.
 * Expansion par le groupId le plus externe de chaque layer touché.
 */
export function expandToGroups(layers: DrawLayer[], ids: string[]): string[] {
  const outerGroupIds = new Set<string>();
  for (const id of ids) {
    const layer = layers.find(l => l.id === id);
    const ogid = layer ? outermostGroupId(layer) : undefined;
    if (ogid) outerGroupIds.add(ogid);
  }
  if (outerGroupIds.size === 0) return ids;

  const expanded = new Set(ids);
  for (const layer of layers) {
    const ogid = outermostGroupId(layer);
    if (ogid && outerGroupIds.has(ogid)) {
      expanded.add(layer.id);
    }
  }
  return Array.from(expanded);
}

/**
 * Crée un groupe : push groupId dans la pile groupIds de chaque membre,
 * rassemble les membres en z-order contigu.
 */
export function createGroup(layers: DrawLayer[], memberIds: string[], groupId: string): DrawLayer[] {
  const memberSet = new Set(memberIds);
  // Position d'insertion = index du membre le plus haut (dernier en z-order)
  let topIndex = -1;
  for (let i = layers.length - 1; i >= 0; i--) {
    if (memberSet.has(layers[i].id)) { topIndex = i; break; }
  }
  if (topIndex === -1) return layers;

  // Séparer membres et non-membres
  const members: DrawLayer[] = [];
  const others: DrawLayer[] = [];
  for (const l of layers) {
    if (memberSet.has(l.id)) {
      const existing = l.groupIds ?? [];
      members.push({ ...l, groupIds: [...existing, groupId] });
    } else {
      others.push(l);
    }
  }

  // Insérer les membres groupés à la position du plus haut
  let insertAt = 0;
  for (let i = 0; i <= topIndex; i++) {
    if (!memberSet.has(layers[i].id)) insertAt++;
  }

  const result = [...others];
  result.splice(insertAt, 0, ...members);
  return result;
}

/**
 * Supprime un groupId spécifique de la pile groupIds de tous les layers concernés.
 * Les groupIds enfants (plus profonds dans la pile) subsistent.
 */
export function ungroupLayers(layers: DrawLayer[], groupId: string): DrawLayer[] {
  return layers.map(l => {
    if (!hasGroupId(l, groupId)) return l;
    const newIds = (l.groupIds ?? []).filter(g => g !== groupId);
    return { ...l, groupIds: newIds.length > 0 ? newIds : undefined };
  });
}

/**
 * Dissout automatiquement les groupes qui ont < 2 membres.
 * Vérifie chaque groupId distinct à tous les niveaux de la hiérarchie.
 */
export function autoDissolveGroups(layers: DrawLayer[]): DrawLayer[] {
  // Compter les membres par groupId (à travers toute la pile)
  const counts = new Map<string, number>();
  for (const l of layers) {
    if (l.groupIds) {
      for (const gid of l.groupIds) {
        counts.set(gid, (counts.get(gid) ?? 0) + 1);
      }
    }
  }

  // Groupes à dissoudre
  const toDissolve = new Set<string>();
  for (const [gid, count] of counts) {
    if (count < 2) toDissolve.add(gid);
  }

  if (toDissolve.size === 0) return layers;

  return layers.map(l => {
    if (!l.groupIds) return l;
    const newIds = l.groupIds.filter(g => !toDissolve.has(g));
    if (newIds.length === l.groupIds.length) return l;
    return { ...l, groupIds: newIds.length > 0 ? newIds : undefined };
  });
}

/**
 * Collapse les groupes en items uniques pour le SelectionPanel (reverse z-order).
 * Regroupe par le groupId le plus externe.
 */
export function getGroupPanelItems(layers: DrawLayer[], selection: string[]): PanelDisplayItem[] {
  const selSet = new Set(selection);
  const selectedLayers = layers.filter(l => selSet.has(l.id));
  const seen = new Set<string>(); // groupIds déjà traités
  const items: PanelDisplayItem[] = [];

  for (const layer of selectedLayers) {
    const ogid = outermostGroupId(layer);
    if (ogid) {
      if (seen.has(ogid)) continue;
      seen.add(ogid);
      // Tous les membres sélectionnés qui partagent ce groupId externe
      const members = selectedLayers.filter(l => outermostGroupId(l) === ogid);
      const topLayer = members[members.length - 1];
      items.push({
        type: 'group',
        groupId: ogid,
        memberIds: members.map(m => m.id),
        topLayer,
      });
    } else {
      items.push({ type: 'single', id: layer.id, layer });
    }
  }

  return items.reverse(); // on-top à gauche
}

/**
 * Vérifie si tous les IDs focusés partagent un même groupId externe unique.
 * Retourne ce groupId ou undefined.
 */
export function getFocusedGroupId(layers: DrawLayer[], focusedIds: string[]): string | undefined {
  if (focusedIds.length === 0) return undefined;
  const groupIds = new Set<string>();
  for (const id of focusedIds) {
    const layer = layers.find(l => l.id === id);
    const ogid = layer ? outermostGroupId(layer) : undefined;
    if (!ogid) return undefined; // au moins un non-groupé
    groupIds.add(ogid);
  }
  return groupIds.size === 1 ? groupIds.values().next().value! : undefined;
}

/** Vérifie si les focusedIds peuvent être groupés (>= 2 et pas déjà tous dans le même groupe externe) */
export function canGroup(layers: DrawLayer[], focusedIds: string[]): boolean {
  if (focusedIds.length < 2) return false;
  return getFocusedGroupId(layers, focusedIds) === undefined;
}

/** Vérifie si les focusedIds peuvent être dégroupés (tous dans le même groupe externe) */
export function canUngroup(layers: DrawLayer[], focusedIds: string[]): boolean {
  if (focusedIds.length === 0) return false;
  return getFocusedGroupId(layers, focusedIds) !== undefined;
}
