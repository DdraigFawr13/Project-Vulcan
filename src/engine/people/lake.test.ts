// 6B review q3 (V-208): a flux caught from the warm lake becomes the tale "the lake sickens in
// summer"; in warm weather one who holds it walks past the lake to the well, with one line a
// year citing the belief, while one who does not drinks at the lake.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { type EntityRow } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { emit, templatesOf } from '../log/index.ts';
import { walkAt } from '../paths/index.ts';
import {
  createSim,
  createWorld,
  needOf,
  step,
  waterSpots,
  withoutAccidents,
  type WorldState,
} from '../index.ts';

const content = withoutAccidents(game);
const sim = createSim(content);
const LAKE = 3; // core WATER index of 'lake'

/** Every drinkable tile made lake water, a well built at the green, and `a`, `b` set down
 * thirsty beside the nearest lake tile more than 3 tiles from it. */
function warmLake(): { w: WorldState; a: EntityRow; b: EntityRow; well: number } {
  const w = createWorld(sim, 'ledger');
  const map = w.map;
  const green = greenOf(w);
  const spots = waterSpots(w, content);
  for (const s of spots) map.water[s.y * map.width + s.x] = LAKE;
  const far = (s: { x: number; y: number }) =>
    Math.max(Math.abs(s.x - green.x), Math.abs(s.y - green.y));
  const lake = [...spots]
    .sort((p, q) => far(p) - far(q) || p.y - q.y || p.x - q.x)
    .find((s) => far(s) > 3)!;
  const bank = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
    .map(([dx, dy]) => ({ x: lake.x + dx!, y: lake.y + dy!, z: 0 }))
    .find((s) => walkAt(content, map, 0, s.y * map.width + s.x) === 1)!;
  const kind = content.buildings.well.kind;
  addEntity(w, 'furniture', {
    ...{ kind, x: green.x, y: green.y, z: 0, facing: '', quality: 0, maker: 0, owner: 0 },
    ...{ made: 0, line: 0, state: 'built', have: 0, work: 0, waited: 0 },
  });
  const [a, b] = w.entities['person'] as [EntityRow, EntityRow];
  for (const p of [a, b]) {
    Object.assign(p, { ...bank, path: [], job: '', target: -1, doing: '', stride: 0 });
    needOf(w, p.id, 'water')!['value'] = 4000;
  }
  return { w, a, b, well: green.y * map.width + green.x };
}

describe('the lake sickens in summer', () => {
  it('sends one who holds it past the warm lake to the well, with a line citing the belief', () => {
    const { w, a, b, well } = warmLake();
    const fed = w.begunEvent;
    const belief = content.health.sick.lakeBelief;
    addEntity(w, 'belief', { person: a.id, belief, strength: 2, line: fed, fed: w.tick });
    const went = new Map<number, number>();
    for (let m = 0; m < 30 && went.size < 2; m += 1) {
      w.systems['weather']!['temp'] = content.health.sick.warmLake + 4;
      step(w, sim, 1);
      for (const p of [a, b])
        if (p['doing'] === 'drink' && !went.has(p.id)) went.set(p.id, (p['drinkAt'] as number) - 1);
    }
    expect(went.get(a.id)).toBe(well);
    expect(w.map.water[went.get(b.id)!]).toBe(LAKE);
    const passed = w.log.filter((e) => e.type === 'people.passedLake');
    expect(passed).toHaveLength(1);
    expect(passed[0]!.actors).toEqual([a.id]);
    expect(passed[0]!.causes).toEqual([fed]);
  });

  it('is held by one who took the flux from the warm lake, once the tale is seen', () => {
    const w = createWorld(sim, 'ledger');
    const p = (w.entities['person'] as EntityRow[])[0]!;
    emit(w, templatesOf(content.events), 'health.sick', {
      causes: [],
      actors: [p.id],
      data: {
        ...{ name: p['name'] as string, ill: 'the flux', Ill: 'The flux', a: 'the flux' },
        how: 'drank from the lake in the warm weather',
      },
    });
    step(w, sim, 1);
    const held = (w.entities['belief'] ?? []).find((r) => r['person'] === p.id);
    expect(held?.['belief']).toBe(content.health.sick.lakeBelief);
    expect(held?.['strength']).toBeGreaterThanOrEqual(content.health.sick.believe);
  });
});
