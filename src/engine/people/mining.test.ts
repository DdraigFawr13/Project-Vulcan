// P4.1 mining, the parts that need a person standing in a prepared spot (a test-only system runs
// them inside a step, with the engine's own context): what digging gives never vanishes, a miner
// leaves no ladder load in their hands, and a tunnel's next tile that turns out to be open ground
// is shown, not dug (V-030).
import { describe, expect, it } from 'vitest';
import { content as base } from '../../content/index.ts';
import {
  createSim,
  createWorld,
  SYSTEMS,
  step,
  submitCommand,
  type System,
  type SystemContext,
  type WorldState,
} from '../index.ts';
import { itemsAt, layItem, loadOf } from '../goods/index.ts';
import { pack } from '../paths/index.ts';
import { layYield, mining } from './mine.ts';
import { stop } from './minetask.ts';

let todo: ((ctx: SystemContext) => void) | undefined;
const probe: System = {
  id: 'test-probe',
  every: 'minute',
  run: (ctx) => {
    const f = todo;
    todo = undefined;
    f?.(ctx);
  },
};
const sim = createSim(base, [...SYSTEMS, probe]);

/** Runs `f` inside the next minute's step, with the engine's context. */
const inside = (world: WorldState, f: (ctx: SystemContext) => void): void => {
  todo = f;
  step(world, sim, 1);
  expect(todo).toBeUndefined();
};

/** A world with its stairs cut (level 1 reached) and a shaft sunk from the start to level 3. */
function dug() {
  const world = createWorld(sim, 'tallow');
  const { startX: x, startY: y } = world.map;
  submitCommand(world, {
    tick: world.tick + 1,
    kind: 'sinkShaft',
    data: { x, y, z: 0, to: 3 },
  });
  step(world, sim, 1);
  return { world, x, y };
}

const kind = (id: string) => base.terrain.kinds.findIndex((k) => k.id === id);

describe('mining by hand', () => {
  it('leaves nothing out of sight: what finds no free tile lies on the dug one', () => {
    const { world, x, y } = dug();
    const map = world.map;
    const level = map.levels[0]!;
    // A dug tile walled in by rock on every side, as one in a tunnel is.
    const [dx, dy] = [x + 5, y + 5];
    for (let j = dy - 4; j <= dy + 4; j += 1)
      for (let i = dx - 4; i <= dx + 4; i += 1) level.tiles[j * map.width + i] = kind('rock-wall');
    level.tiles[dy * map.width + dx] = kind('stone-floor');
    // More ore than one stack takes (25 in a stack): the rest still lies there.
    inside(world, (ctx) => layYield(ctx, 'iron-ore', 60, { x: dx, y: dy, z: 1 }, world.begunEvent));
    const here = itemsAt(world, dx, dy, 1);
    expect(here.every((i) => i['kind'] === 'iron-ore')).toBe(true);
    expect(here.reduce((n, i) => n + (i['count'] as number), 0)).toBe(60);
  });

  it('lays down the ladder logs a miner holds when the task ends', () => {
    const { world, x, y } = dug();
    const p = (world.entities['person'] ?? [])[0]!;
    Object.assign(p, { x, y, z: 0, job: 'mine', task: 'sink', target: -1 });
    const id = layItem(world, { kind: 'logs', count: 1, x, y, z: 0, made: world.begunEvent });
    (world.entities['item'] ?? []).find((i) => i.id === id)!['holder'] = p.id;
    expect(loadOf(world, p.id)).toBeDefined();
    inside(world, (ctx) => stop(ctx, p));
    expect(loadOf(world, p.id)).toBeUndefined();
    const logs = (world.entities['item'] ?? []).find((i) => i.id === id)!;
    expect([logs['holder'], logs['x'], logs['y'], logs['z']]).toEqual([0, p['x'], p['y'], p['z']]);
    expect(p['job']).toBe('');
  });

  it('shows a tunnel tile that is open ground instead of digging it, then finds the way again', () => {
    const { world, x, y } = dug();
    const map = world.map;
    const level = map.levels[2]!;
    const next = y * map.width + x + 1;
    level.tiles[next] = kind(base.terrain.generator.underground.caves.kind);
    level.known[next] = 0;
    const p = (world.entities['person'] ?? [])[0]!;
    Object.assign(p, { x, y, z: 3, job: 'mine', task: 'tunnel', what: 'iron', work: 5 });
    Object.assign(p, { target: pack(map, { x: x + 1, y, z: 3 }), took: world.begunEvent });
    const lines = world.log.length;
    inside(world, (ctx) => mining(ctx, p));
    expect(level.known[next]).toBe(1);
    expect(level.tiles[next]).toBe(kind(base.terrain.generator.underground.caves.kind));
    expect(p['work']).toBe(5);
    const added = world.log.slice(lines).map((e) => e.type);
    expect(added).toContain('map.opened');
    expect(added).not.toContain('mine.dug');
  });
});
