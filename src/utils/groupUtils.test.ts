import { describe, it, expect } from 'vitest';
import {
  expandToGroups,
  createGroup,
  ungroupLayers,
  autoDissolveGroups,
  getGroupPanelItems,
  getFocusedGroupId,
  canGroup,
  canUngroup,
} from './groupUtils';
import { DrawLayer, Stroke } from '../types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeStroke(id: string, groupIds?: string[]): Stroke {
  return {
    id,
    tool: 'pen',
    color: '#000',
    width: 2,
    points: [0, 0, 10, 10],
    opacity: 1,
    ...(groupIds ? { groupIds } : {}),
  };
}

// ─── expandToGroups ────────────────────────────────────────────────────────

describe('expandToGroups', () => {
  it('retourne les IDs tels quels si aucun layer n\'est groupé', () => {
    const layers: DrawLayer[] = [makeStroke('a'), makeStroke('b'), makeStroke('c')];
    expect(expandToGroups(layers, ['a'])).toEqual(['a']);
  });

  it('étend la sélection à tous les membres du même groupe', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g1']),
      makeStroke('c'),
    ];
    const result = expandToGroups(layers, ['a']);
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).not.toContain('c');
  });

  it('étend plusieurs groupes distincts', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g1']),
      makeStroke('c', ['g2']),
      makeStroke('d', ['g2']),
    ];
    const result = expandToGroups(layers, ['a', 'c']);
    expect(result.sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('expansion par le groupId le plus externe (nested groups)', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g-inner', 'g-outer']),
      makeStroke('b', ['g-inner', 'g-outer']),
      makeStroke('c', ['g-outer']),
    ];
    const result = expandToGroups(layers, ['a']);
    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });

  it('ID inexistant → retourné tel quel sans crash', () => {
    const layers: DrawLayer[] = [makeStroke('a')];
    expect(expandToGroups(layers, ['inexistant'])).toEqual(['inexistant']);
  });

  it('liste vide → liste vide', () => {
    expect(expandToGroups([], [])).toEqual([]);
  });

  it('mélange groupé et non groupé', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g1']),
      makeStroke('c'),
    ];
    const result = expandToGroups(layers, ['a', 'c']);
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
  });
});

// ─── createGroup ───────────────────────────────────────────────────────────

describe('createGroup', () => {
  it('ajoute le groupId à chaque membre', () => {
    const layers: DrawLayer[] = [makeStroke('a'), makeStroke('b'), makeStroke('c')];
    const result = createGroup(layers, ['a', 'b'], 'g1');
    const a = result.find(l => l.id === 'a')!;
    const b = result.find(l => l.id === 'b')!;
    const c = result.find(l => l.id === 'c')!;
    expect(a.groupIds).toEqual(['g1']);
    expect(b.groupIds).toEqual(['g1']);
    expect(c.groupIds).toBeUndefined();
  });

  it('empile sur les groupIds existants (nested group)', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g-inner']),
      makeStroke('b', ['g-inner']),
    ];
    const result = createGroup(layers, ['a', 'b'], 'g-outer');
    expect(result.find(l => l.id === 'a')!.groupIds).toEqual(['g-inner', 'g-outer']);
  });

  it('regroupe les membres en z-order contigu', () => {
    const layers: DrawLayer[] = [makeStroke('a'), makeStroke('x'), makeStroke('b')];
    const result = createGroup(layers, ['a', 'b'], 'g1');
    const ids = result.map(l => l.id);
    const aIdx = ids.indexOf('a');
    const bIdx = ids.indexOf('b');
    expect(Math.abs(aIdx - bIdx)).toBe(1);
  });

  it('memberIds vides ou inexistants → layers inchangés', () => {
    const layers: DrawLayer[] = [makeStroke('a')];
    const result = createGroup(layers, ['inexistant'], 'g1');
    expect(result).toEqual(layers);
  });
});

// ─── ungroupLayers ─────────────────────────────────────────────────────────

describe('ungroupLayers', () => {
  it('retire le groupId spécifique', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g1']),
    ];
    const result = ungroupLayers(layers, 'g1');
    expect(result[0].groupIds).toBeUndefined();
    expect(result[1].groupIds).toBeUndefined();
  });

  it('préserve les autres groupIds (nested)', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g-inner', 'g-outer']),
    ];
    const result = ungroupLayers(layers, 'g-outer');
    expect(result[0].groupIds).toEqual(['g-inner']);
  });

  it('ne touche pas les layers non concernés', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b'),
    ];
    const result = ungroupLayers(layers, 'g1');
    expect(result[1]).toBe(layers[1]);
  });

  it('groupId inexistant → layers inchangés', () => {
    const layers: DrawLayer[] = [makeStroke('a', ['g1'])];
    const result = ungroupLayers(layers, 'g-inexistant');
    expect(result[0]).toBe(layers[0]);
  });
});

// ─── autoDissolveGroups ────────────────────────────────────────────────────

describe('autoDissolveGroups', () => {
  it('dissout un groupe avec un seul membre', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b'),
    ];
    const result = autoDissolveGroups(layers);
    expect(result[0].groupIds).toBeUndefined();
  });

  it('préserve un groupe avec >= 2 membres', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g1']),
    ];
    const result = autoDissolveGroups(layers);
    expect(result[0].groupIds).toEqual(['g1']);
    expect(result[1].groupIds).toEqual(['g1']);
  });

  it('dissout sélectivement dans un mix', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g2']),
      makeStroke('c', ['g2']),
    ];
    const result = autoDissolveGroups(layers);
    expect(result[0].groupIds).toBeUndefined();
    expect(result[1].groupIds).toEqual(['g2']);
  });

  it('aucun groupe → layers inchangés', () => {
    const layers: DrawLayer[] = [makeStroke('a'), makeStroke('b')];
    const result = autoDissolveGroups(layers);
    expect(result).toBe(layers);
  });
});

// ─── getFocusedGroupId ─────────────────────────────────────────────────────

describe('getFocusedGroupId', () => {
  it('retourne le groupId si tous les focusedIds partagent le même groupe externe', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g1']),
    ];
    expect(getFocusedGroupId(layers, ['a', 'b'])).toBe('g1');
  });

  it('retourne undefined si les focusedIds sont dans des groupes différents', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g2']),
    ];
    expect(getFocusedGroupId(layers, ['a', 'b'])).toBeUndefined();
  });

  it('retourne undefined si au moins un layer n\'est pas groupé', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b'),
    ];
    expect(getFocusedGroupId(layers, ['a', 'b'])).toBeUndefined();
  });

  it('retourne undefined pour une liste vide', () => {
    expect(getFocusedGroupId([], [])).toBeUndefined();
  });
});

// ─── canGroup / canUngroup ─────────────────────────────────────────────────

describe('canGroup', () => {
  it('true si >= 2 items non groupés ensemble', () => {
    const layers: DrawLayer[] = [makeStroke('a'), makeStroke('b')];
    expect(canGroup(layers, ['a', 'b'])).toBe(true);
  });

  it('false si < 2 items', () => {
    const layers: DrawLayer[] = [makeStroke('a')];
    expect(canGroup(layers, ['a'])).toBe(false);
    expect(canGroup(layers, [])).toBe(false);
  });

  it('false si déjà dans le même groupe externe', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g1']),
    ];
    expect(canGroup(layers, ['a', 'b'])).toBe(false);
  });
});

describe('canUngroup', () => {
  it('true si tous dans le même groupe externe', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g1']),
    ];
    expect(canUngroup(layers, ['a', 'b'])).toBe(true);
  });

  it('false si pas de groupe commun', () => {
    const layers: DrawLayer[] = [makeStroke('a'), makeStroke('b')];
    expect(canUngroup(layers, ['a', 'b'])).toBe(false);
  });

  it('false si liste vide', () => {
    expect(canUngroup([], [])).toBe(false);
  });
});

// ─── getGroupPanelItems ────────────────────────────────────────────────────

describe('getGroupPanelItems', () => {
  it('retourne des singles pour des layers non groupés', () => {
    const layers: DrawLayer[] = [makeStroke('a'), makeStroke('b')];
    const items = getGroupPanelItems(layers, ['a', 'b']);
    expect(items).toHaveLength(2);
    expect(items.every(i => i.type === 'single')).toBe(true);
  });

  it('collapse un groupe en un seul item', () => {
    const layers: DrawLayer[] = [
      makeStroke('a', ['g1']),
      makeStroke('b', ['g1']),
      makeStroke('c'),
    ];
    const items = getGroupPanelItems(layers, ['a', 'b', 'c']);
    expect(items).toHaveLength(2);
    const groupItem = items.find(i => i.type === 'group')!;
    expect(groupItem.type === 'group' && groupItem.memberIds.sort()).toEqual(['a', 'b']);
  });

  it('retourne les items en reverse z-order (on-top à gauche)', () => {
    const layers: DrawLayer[] = [makeStroke('bottom'), makeStroke('top')];
    const items = getGroupPanelItems(layers, ['bottom', 'top']);
    expect(items[0].type === 'single' && items[0].id).toBe('top');
    expect(items[1].type === 'single' && items[1].id).toBe('bottom');
  });

  it('sélection vide → items vides', () => {
    const layers: DrawLayer[] = [makeStroke('a')];
    expect(getGroupPanelItems(layers, [])).toEqual([]);
  });
});
