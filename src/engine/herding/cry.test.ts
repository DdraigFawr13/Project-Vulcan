// 6B review q2 (V-208): a wolf falls on someone asleep alone in the open at night; a bold, armed
// grown-up asleep within earshot wakes to the cry, runs to them and strikes the wolf. Further off
// than earshot, nobody comes and the fight is at once, as before.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { cheb, clockAt, type EntityRow } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { HELD, layItem } from '../goods/index.ts';
import { whyOf } from '../log/index.ts';
import { reachFrom, walkAt, type Spot } from '../paths/index.ts';
import { createSim, createWorld, step, withoutAccidents, type WorldState } from '../index.ts';
import { memoriesOf } from '../needs/index.ts';
import { animalsOf, packOf } from '../wild/index.ts';

// Accidents are left out, and every blow lands, so the test reads the cry, not the dice.
const base = withoutAccidents(game);
const folk = { ...base.wild.folk, strike: { base: 100, perLevel: 0, most: 100 } };
const content = { ...base, wild: { ...base.wild, folk } };
const sim = createSim(content);
const lines = (w: WorldState, type: string) => w.log.filter((e) => e.type === type);

/** Open ground the green reaches, on the ring `d` tiles out from `from`: the first by scan. */
function openRing(w: WorldState, from: Spot, d: number): Spot {
  const reach = reachFrom(content, w.map, greenOf(w));
  const { width, height } = w.map;
  for (let y = Math.max(0, from.y - d); y <= Math.min(height - 1, from.y + d); y += 1)
    for (let x = Math.max(0, from.x - d); x <= Math.min(width - 1, from.x + d); x += 1) {
      const at = { x, y, z: 0 };
      if (cheb(at, from) !== d || w.map.features[y * width + x]) continue;
      if (walkAt(content, w.map, 0, y * width + x) === 1 && reach(at)) return at;
    }
  throw new Error('no open ground');
}

/** Puts `p` asleep at `at`, with nothing in hand and nothing to do. */
const asleep = (p: EntityRow, at: Spot): void => {
  Object.assign(p, { ...at, path: [], job: '', target: -1, doing: 'sleep', stride: 0 });
};

/** Night, the pack starving, `lone` asleep at `spot` with a wolf beside, `bold` asleep `d` tiles
 * off with an axe and a steady nerve; everyone else at the green. */
function fallOn(d: number): { w: WorldState; lone: EntityRow; bold: EntityRow } {
  const w = createWorld(sim, 'anvil/1');
  while (clockAt(w.tick, content.calendar).hour !== 22) step(w, sim, 60);
  const [lone, bold, ...rest] = w.entities['person'] as [EntityRow, EntityRow, ...EntityRow[]];
  const green = greenOf(w);
  const spot = openRing(w, green, 22);
  for (const q of rest) asleep(q, { ...green, z: 0 });
  asleep(lone, spot);
  asleep(bold, openRing(w, spot, d));
  for (const t of (w.entities['trait'] ?? []).filter((r) => r['person'] === bold.id))
    removeEntity(w, 'trait', t.id);
  addEntity(w, 'trait', { person: bold.id, trait: 'steady' });
  const axe = content.items.find((i) => i.tool?.kind === 'axe')!.id;
  layItem(w, { kind: axe, count: 1, ...HELD, made: 0 }, { owner: bold.id, state: 'held' });
  const pack = packOf(w)!;
  pack['hunger'] = 16;
  const [wolf] = animalsOf(w).filter((a) => a['pack']);
  Object.assign(wolf!, { ...openRing(w, spot, 1), path: [], state: '' });
  return { w, lone, bold };
}

describe('the cry', () => {
  it('wakes a bold armed neighbour in earshot, who runs to them and strikes the wolf', () => {
    const { w, lone, bold } = fallOn(6);
    step(w, sim, 1);
    const cry = lines(w, 'wild.cry');
    expect(cry).toHaveLength(1);
    expect(cry[0]!.actors).toEqual([lone.id, bold.id]);
    expect(bold['doing']).toBe('answer');
    expect(lines(w, 'wild.attacked')).toHaveLength(0);
    step(w, sim, content.wild.folk.cry.minutes + 1);
    const attacked = lines(w, 'wild.attacked');
    expect(attacked).toHaveLength(1);
    expect(attacked[0]!.actors).toEqual([lone.id, bold.id]);
    expect(attacked[0]!.data['fight']).toContain(`${bold['name']} struck it`);
    expect(whyOf(w, attacked[0]!.id).map((c) => c.event.id)).toContain(cry[0]!.id);
    const kept = memoriesOf(w, bold.id).map((m) => m['memory']);
    expect(kept).toContain(content.wild.folk.memories.fought);
    expect(kept).toContain(content.wild.folk.memories.stood);
    expect(bold['doing']).not.toBe('answer');
  });

  it('brings nobody from beyond earshot: the fight is at once, as before', () => {
    const { w, lone } = fallOn(content.wild.folk.cry.earshot + 2);
    step(w, sim, 1);
    expect(lines(w, 'wild.cry')).toHaveLength(0);
    expect(lines(w, 'wild.attacked')[0]!.actors).toEqual([lone.id]);
  });
});
