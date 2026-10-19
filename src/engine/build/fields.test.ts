// P4.7 done-whens (engine): with no order to anyone, the band lays out a field outside the town
// ring with a reason, sows it in spring, reaps it, and grain plus seed reach the store, the
// harvest lines leading back to the sowing; a frost kills a sown crop and the line cites the
// spell; a field the widened ring covers is left to grass only after its harvest; the Build
// sheet's Fields level and one send-back; every command is a lever or a test-mode tool.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { granaryOf, inGranary, inStore, itemsOf, wantOf } from '../goods/index.ts';
import { memoriesOf } from '../needs/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  greenOf,
  SYSTEMS,
  step,
  submitCommand,
  TEST_TOOLS,
  whyOf,
} from '../index.ts';
import { fieldsOf, ringOf } from './index.ts';

const sim = createSim(content);
const DAY = 1440;
const SEEDS = ['ledger', 'tallow', 'anvil'];
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const types = (w: World, id: number) => whyOf(w, id).map((c) => c.event.type);
/** The types of every line behind `id`, however old (the ledger's sealed days included). */
function chain(w: World, id: number): string[] {
  const byId = new Map(allLines(w).map((e) => [e.id, e]));
  const out: string[] = [];
  const seen = new Set<number>();
  const todo = [id];
  for (let at = todo.pop(); at !== undefined; at = todo.pop()) {
    if (seen.has(at)) continue;
    seen.add(at);
    const e = byId.get(at);
    if (!e) continue;
    out.push(e.type);
    todo.push(...e.causes);
  }
  return out;
}
const far = (w: World, i: number) => {
  const g = greenOf(w);
  return Math.max(Math.abs((i % w.map.width) - g.x), Math.abs(Math.floor(i / w.map.width) - g.y));
};

describe('fields', () => {
  for (const seed of SEEDS) {
    it(`lays out a field outside the ring with a reason, unordered, on ${seed}`, () => {
      const world = createWorld(sim, seed);
      step(world, sim, DAY);
      expect(world.commandLog).toHaveLength(0);
      const sited = lines(world, 'field.sited')[0]!;
      expect(sited.data['why']).toContain('good soil outside the town ring');
      expect(types(world, sited.id)).toContain('field.needed');
      const field = fieldsOf(world)[0]!;
      const tiles = field['tiles'] as number[];
      expect(tiles.length).toBeGreaterThanOrEqual(content.buildings.field.least);
      for (const i of tiles) {
        expect(far(world, i)).toBeGreaterThan(ringOf(world, content));
        expect(world.map.fertility[i]).toBeGreaterThanOrEqual(content.buildings.field.good);
      }
    });
  }

  it('sows in spring, reaps when ripe, and brings grain and seed to the store', () => {
    const world = createWorld(sim, SEEDS[0]!);
    const stored = (kind: string) =>
      itemsOf(world)
        .filter((i) => i['kind'] === kind && inStore(world, i['x'] as number, i['y'] as number, 0))
        .reduce((n, i) => n + (i['count'] as number), 0);
    step(world, sim, 80 * DAY);
    // The cart's seed went into the ground, a seed a tile; the turnips sown after the barley use
    // the harvest's seed again, so watch the store hour by hour.
    const sown = fieldsOf(world).reduce((n, f) => n + (f['tiles'] as number[]).length, 0);
    const before = stored('seed');
    const cart = content.life.cart.goods.find((g) => g.kind === 'seed')!.count;
    expect(before).toBeLessThanOrEqual(cart - sown);
    const most = { grain: 0, seed: 0 };
    // Each reaper remembers bringing it in (V-091), the memory citing the harvest home.
    let remembered: boolean | undefined;
    for (let hour = 0; hour < 20 * 24; hour += 1) {
      step(world, sim, 60);
      const home = lines(world, 'farm.harvestHome')[0];
      if (home && remembered === undefined)
        remembered = home.actors.every((id) =>
          memoriesOf(world, id).some((m) => m['memory'] === 'harvested' && m['line'] === home.id),
        );
      most.grain = Math.max(most.grain, stored('grain'));
      most.seed = Math.max(most.seed, stored('seed'));
    }
    expect(world.commandLog).toHaveLength(0);
    const harvested = lines(world, 'field.harvested')[0]!;
    expect(harvested.data['crop']).toBe('barley');
    expect(harvested.data['kept']).toBeGreaterThan(0);
    // The harvest leads back through ripening to the sowing and the siting.
    expect(chain(world, harvested.id)).toEqual(
      expect.arrayContaining([
        ...['work.tookUpReaping', 'field.ripe', 'field.sown', 'work.tookUpSowing'],
        ...['field.sited', 'field.needed'],
      ]),
    );
    const home = lines(world, 'farm.harvestHome')[0]!;
    expect(home.causes).toContain(harvested.id);
    expect(home.actors.length).toBeGreaterThan(0);
    expect(remembered).toBe(true);
    // Hauled in: grain stands in the store, and the seed the cart brought was topped up.
    expect(most.grain).toBeGreaterThan(0);
    expect(most.seed).toBeGreaterThan(before);
  }, 20000);

  it('lays a field as one compact block just outside the ring', () => {
    const world = createWorld(sim, SEEDS[0]!);
    step(world, sim, DAY);
    const tiles = fieldsOf(world)[0]!['tiles'] as number[];
    const w = world.map.width;
    const xs = tiles.map((i) => i % w);
    const ys = tiles.map((i) => Math.floor(i / w));
    const [bw, bh] = [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1];
    expect(bw * bh).toBe(tiles.length);
    expect(Math.abs(bw - bh)).toBeLessThanOrEqual(1);
    expect(tiles.length).toBeLessThanOrEqual(5 * content.buildings.field.perMouth);
    expect(Math.min(...tiles.map((i) => far(world, i)))).toBeLessThanOrEqual(
      ringOf(world, content) + 6,
    );
  });

  it('puts the surplus of a reaped field beyond the Food plate on granary tiles', () => {
    const world = createWorld(sim, SEEDS[0]!);
    const food = (where: (x: number, y: number) => boolean) =>
      itemsOf(world)
        .filter((i) => !i['holder'] && content.life.eat[i['kind'] as string] !== undefined)
        .filter((i) => i['kind'] !== 'seed' && where(i['x'] as number, i['y'] as number))
        .reduce((n, i) => n + (i['count'] as number), 0);
    // Hour by hour until the first surplus is on granary tiles.
    while (!food((x, y) => inGranary(world, x, y, 0)) && world.tick < 120 * DAY)
      step(world, sim, 60);
    const laid = lines(world, 'field.granaryLaid')[0]!;
    expect(laid.data['where']).toBe('the barley field');
    expect(chain(world, laid.id)).toContain('field.harvested');
    expect(granaryOf(world).length).toBeGreaterThanOrEqual(content.buildings.granary.width);
    const plate = wantOf(world, content, 'food');
    // The granary's tiles are not the home store, and it holds the surplus the store does not.
    expect(
      granaryOf(world).some((g) => inStore(world, g['x'] as number, g['y'] as number, 0)),
    ).toBe(false);
    // Food goes to a granary only while the store holds its plate (a meal or a load either side).
    expect(food((x, y) => inStore(world, x, y, 0))).toBeGreaterThanOrEqual(
      plate - content.work.haul.load,
    );
    expect(food((x, y) => inGranary(world, x, y, 0))).toBeGreaterThan(0);
  }, 30000);

  it('loses a sown crop to frost and the line cites the weather spell', () => {
    const world = createWorld(sim, SEEDS[0]!);
    while (!lines(world, 'field.sown').length && world.tick < 3 * DAY) step(world, sim, 60);
    expect(fieldsOf(world)[0]!['state']).toBe('sown');
    expect(lines(world, 'field.frostKilled')).toHaveLength(0);
    // A hard frost in the night: the day's temperature falls well under the crop's frost line.
    world.systems['weather']!['temp'] = -20;
    step(world, sim, 120);
    const killed = lines(world, 'field.frostKilled')[0]!;
    expect(killed.data['tiles']).toBeGreaterThan(0);
    expect(types(world, killed.id)).toContain('weather.changed');
    expect(fieldsOf(world)[0]!['state']).toBe('fallow');
    // Nobody sows into the frost again while it lasts.
    step(world, sim, 360);
    expect(lines(world, 'work.tookUpSowing').filter((e) => e.id > killed.id)).toHaveLength(0);
  });

  it('widens the town ring when no ground fits a house, and leaves a field only after its harvest', () => {
    // No house ever fits, so the ring widens a step a day; crops ripen in a day.
    const huge = { ...content.buildings.house.stage, id: 'huge', name: 'huge', w: 30, h: 30 };
    const quick = content.buildings.field.crops.map((c) => ({ ...c, days: 1 }));
    const buildings = {
      ...content.buildings,
      house: { ...content.buildings.house, sizes: [huge] },
      field: { ...content.buildings.field, crops: quick },
    };
    const narrow = createSim({ ...content, buildings });
    const world = createWorld(narrow, SEEDS[0]!);
    step(world, narrow, 5 * DAY);
    const widened = lines(world, 'town.ringWidened');
    expect(widened.length).toBeGreaterThan(1);
    expect(lines(world, 'build.noGround').map((e) => e.id)).toContain(widened[0]!.causes[0]);
    expect(ringOf(world, content)).toBeGreaterThan(content.buildings.town.ring);
    const left = lines(world, 'field.leftToGrass');
    expect(left.length).toBeGreaterThan(0);
    const at = (e: { data: Record<string, string | number> }) => `${e.data['x']},${e.data['y']}`;
    for (const e of left) {
      expect(chain(world, e.id)).toContain('town.ringWidened');
      // A crop that was sown is harvested before its field is left.
      const sown = lines(world, 'field.sown').filter((s) => at(s) === at(e) && s.id < e.id);
      const reaped = lines(world, 'field.harvested').filter((h) => at(h) === at(e) && h.id < e.id);
      if (sown.length) expect(reaped.length).toBeGreaterThan(0);
    }
    // At least one field was sown, harvested and then left (not dropped while still unsown).
    expect(left.some((e) => lines(world, 'field.harvested').some((h) => at(h) === at(e)))).toBe(
      true,
    );
  }, 30000);

  it('sets the Fields level and sends a plan back once', () => {
    const world = createWorld(sim, SEEDS[0]!);
    while (!fieldsOf(world).length && world.tick < DAY) step(world, sim, 10);
    const first = fieldsOf(world).find((f) => f['state'] === 'plan')!;
    submitCommand(world, {
      tick: world.tick + 1,
      kind: 'setBuild',
      data: { kind: 'field', level: 4 },
    });
    submitCommand(world, {
      tick: world.tick + 1,
      kind: 'setBuild',
      data: { kind: 'barn', level: 1 },
    });
    submitCommand(world, { tick: world.tick + 2, kind: 'sendBack', data: { field: first.id } });
    step(world, sim, 60);
    expect(lines(world, 'build.wantSet')[0]?.data).toEqual({ kind: 'Fields', word: 'last' });
    expect(lines(world, 'command.refused')[0]?.data['kind']).toBe('setBuild');
    expect(first['state']).toBe('sent');
    expect(lines(world, 'field.sentBack')).toHaveLength(1);
    // The colony chooses again at once, on other ground, and that plan cannot be sent back.
    const again = fieldsOf(world).find((f) => f['state'] === 'plan')!;
    const old = new Set(first['tiles'] as number[]);
    expect((again['tiles'] as number[]).some((i) => old.has(i))).toBe(false);
    expect(lines(world, 'field.sited')).toHaveLength(2);
    submitCommand(world, { tick: world.tick + 1, kind: 'sendBack', data: { field: again.id } });
    step(world, sim, 60);
    expect(lines(world, 'command.refused').at(-1)?.data['reason']).toBe(
      'it was sent back once already',
    );
  });

  it('has only indirect levers and test-mode tools (V-041)', () => {
    const levers = ['setStock', 'setPriority', 'setLaw', 'setBuild', 'sendBack', 'sendBackShaft'];
    const kinds = SYSTEMS.flatMap((s) => Object.keys(s.commands ?? {}));
    expect(kinds.filter((k) => !levers.includes(k) && !TEST_TOOLS.includes(k))).toEqual([]);
  });
});
