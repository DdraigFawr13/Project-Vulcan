// 5B Bundle 4 as the page shows it: the mill's wheel on the map, turning or iced (V-150), and the
// mill's tile page with its one Send back while nothing on it is built.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, WATER, type WorldState } from '../engine/index.ts';
import { addEntity } from '../engine/entity/index.ts';
import { millGoods, tileMill } from './mill.ts';

const sim = createSim(content);
const nobody = () => ({}) as never;

/** A planned mill beside the first river or stream tile of a fresh world. */
function mill(world: WorldState) {
  const map = world.map;
  const wheel = map.water.findIndex((w) => ['river', 'stream'].includes(WATER[w] ?? ''));
  const [wx, wy] = [wheel % map.width, Math.floor(wheel / map.width)];
  const id = addEntity(world, 'mill', {
    ...{ x: wx + 1, y: wy - 1, w: 4, h: 4, wheel, state: 'plan', line: 0, built: 0 },
    ...{ why: 'the running water nearest the granary', sent: 0, stones: 0, stood: 0 },
  });
  return { id, wheel, wx, wy, row: world.entities['mill']!.find((m) => m.id === id)! };
}

describe('the mill on the page', () => {
  it('draws its wheel faint while planned, turning once built, and iced while frozen', () => {
    const world = createWorld(sim, 'anvil');
    const m = mill(world);
    expect(millGoods(world)).toEqual([
      { x: m.wx, y: m.wy, z: 0, art: 'furn.wheel', facing: 's', plan: true },
    ]);
    m.row['state'] = 'built';
    expect(millGoods(world)[0]).toMatchObject({ art: 'furn.wheel', plan: false });
    world.map.ice[m.wheel] = 0x80 | content.seasons.ice.cap;
    expect(millGoods(world)[0]).toMatchObject({ art: 'furn.wheel.ice' });
    const page = tileMill(world, m.wx, m.wy, nobody)!.works;
    expect(Object.fromEntries(page.rows)['wheel']).toMatch(/^iced over/);
    expect(Object.fromEntries(page.rows)['grinding']).toMatch(/^at the quern/);
  });

  it('offers Send back on its page while nothing is built, and not once it is used', () => {
    const world = createWorld(sim, 'anvil');
    const m = mill(world);
    const page = tileMill(world, m.wx + 1, m.wy, nobody)!.works;
    expect(page.name).toBe('Mill');
    expect(page.back).toBe(m.id);
    expect(Object.fromEntries(page.rows)['why here']).toBe(
      'the running water nearest the granary.',
    );
    expect(Object.fromEntries(page.rows)['oven']).toMatch(/^none yet/);
    m.row['sent'] = 1;
    const used = tileMill(world, m.wx + 1, m.wy, nobody)!.works;
    expect(used.back).toBeUndefined();
    expect(Object.fromEntries(used.rows)['send back']).toMatch(/^used/);
    expect(tileMill(world, m.wx - 3, m.wy, nobody)).toBeUndefined();
  });
});
