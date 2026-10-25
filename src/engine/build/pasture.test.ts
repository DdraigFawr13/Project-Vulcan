// Phase 5 Bundle 3 done-whens (engine, slice A): with no order to anyone, the colony sites a
// pasture outside the town ring while wild sheep graze the valley, plans its hurdles with their
// two gates, and says when they stand; the Pasture row and one send-back are the only levers.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  greenOf,
  step,
  submitCommand,
  withoutAccidents,
} from '../index.ts';
import { canReach } from '../paths/index.ts';
import {
  foldTiles,
  grazingTiles,
  livePastures,
  meadowTiles,
  onPastureGround,
  PASTURE_KIND,
  pasturesOf,
  plansOf,
  ringOf,
} from './index.ts';

// Without accidents: someone laid up in the open would hold the pasture back (it waits for roofs).
const content = withoutAccidents(game);
const sim = createSim(content);
const DAY = 1440;
// anvil/1 has two wild sheep herds (measured); the pasture is sited on day 4 and built on day 9.
const SEED = 'anvil/1';
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
/** The types of every line behind `id`, however old (the ledger's sealed days included). */
function chain(w: World, id: number): string[] {
  const byId = new Map(allLines(w).map((e) => [e.id, e]));
  const seen = new Set<number>();
  const todo = [id];
  for (let at = todo.pop(); at !== undefined; at = todo.pop()) {
    if (seen.has(at)) continue;
    seen.add(at);
    todo.push(...(byId.get(at)?.causes ?? []));
  }
  return [...seen].map((i) => byId.get(i)?.type ?? '');
}
const hurdles = (w: World, id: number) => plansOf(w).filter((p) => p['house'] === id);

/** Steps day by day until the colony has sited a pasture (it waits until all have a roof). */
function siteOne(w: World): number {
  let days = 0;
  while (!pasturesOf(w).length && days < 15) {
    step(w, sim, DAY);
    days += 1;
  }
  return days;
}

describe('pasture', () => {
  const world = createWorld(sim, SEED);
  const sitedDay = siteOne(world);

  it('is sited unordered, outside the ring, with a reason that leads back to the need', () => {
    expect(world.commandLog).toHaveLength(0);
    expect(sitedDay).toBeLessThanOrEqual(8);
    expect(PASTURE_KIND).toBe('pasture');
    const sited = lines(world, 'pasture.sited')[0]!;
    expect(sited.data['tiles']).toBe((content.flock.pasture.w - 2) * (content.flock.pasture.h - 2));
    expect(sited.data['why']).toContain('open grass');
    expect(chain(world, sited.id)).toContain('pasture.needed');
    const p = livePastures(world)[0]!;
    expect(p['state']).toBe('plan');
    const g = greenOf(world);
    const width = world.map.width;
    for (let y = p['y'] as number; y < (p['y'] as number) + (p['h'] as number); y += 1)
      for (let x = p['x'] as number; x < (p['x'] as number) + (p['w'] as number); x += 1)
        expect(Math.max(Math.abs(x - g.x), Math.abs(y - g.y))).toBeGreaterThan(
          ringOf(world, content),
        );
    expect(
      onPastureGround(
        p,
        width,
        (p['rick'] as number) % width,
        Math.floor((p['rick'] as number) / width),
      ),
    ).toBe(true);
  });

  it('plans 47 hurdles with two gates, a fold, grazing and a meadow, clear of everything else', () => {
    const p = livePastures(world)[0]!;
    const plans = hurdles(world, p.id);
    expect(plans).toHaveLength(47);
    expect(plans.filter((q) => q['part'] === content.flock.pasture.gate)).toHaveLength(2);
    expect(plans.filter((q) => q['part'] === content.flock.pasture.hurdle)).toHaveLength(45);
    const width = world.map.width;
    expect(new Set(plans.map((q) => (q['y'] as number) * width + (q['x'] as number))).size).toBe(
      47,
    );
    expect(foldTiles(width, p)).toHaveLength(content.flock.pasture.fold ** 2);
    expect(grazingTiles(width, p)).toHaveLength(47);
    const meadow = meadowTiles(width, p);
    expect(meadow).toHaveLength(84);
    const mine = new Set([...grazingTiles(width, p), ...foldTiles(width, p), ...meadow]);
    expect(mine.size).toBe(47 + 16 + 84);
    // No other plan, field or house stands on its ground.
    for (const q of plansOf(world).filter((r) => r['house'] !== p.id))
      expect(onPastureGround(p, width, q['x'] as number, q['y'] as number)).toBe(false);
    for (const f of world.entities['field'] ?? [])
      for (const i of f['tiles'] as number[])
        expect(onPastureGround(p, width, i % width, Math.floor(i / width))).toBe(false);
    // The fold's gate is on its inner wall, the outer gate on an edge.
    const gates = plans.filter((q) => q['part'] === content.flock.pasture.gate);
    const idx = gates.map((q) => (q['y'] as number) * width + (q['x'] as number));
    expect(idx.sort()).toEqual([p['gate'] as number, p['foldGate'] as number].sort());
  });

  it('is built once the hurdles stand, citing the sited line', () => {
    step(world, sim, 15 * DAY);
    const built = lines(world, 'pasture.built');
    expect(built).toHaveLength(1);
    expect(built[0]!.data['holds']).toBe(content.flock.pasture.holds);
    const p = pasturesOf(world)[0]!;
    expect(p['state']).toBe('built');
    expect(hurdles(world, p.id).every((q) => q['state'] === 'built')).toBe(true);
    expect(chain(world, built[0]!.id)).toContain('pasture.sited');
    // Through the outer gate and the fold's gate, every grazing and fold tile can be walked to
    // from the green (the outer gate opens onto grazing ground, never onto a fold wall).
    const width = world.map.width;
    const g = greenOf(world);
    for (const i of [...grazingTiles(width, p), ...foldTiles(width, p)])
      expect(
        canReach(
          content,
          world.map,
          { x: g.x, y: g.y, z: 0 },
          {
            x: i % width,
            y: Math.floor(i / width),
            z: 0,
          },
        ),
      ).toBe(true);
  });

  it('takes the Pasture row and one send-back, then chooses again', () => {
    const w = createWorld(sim, SEED);
    siteOne(w);
    const first = pasturesOf(w)[0]!;
    submitCommand(w, { tick: w.tick + 1, kind: 'setBuild', data: { kind: 'pasture', level: 4 } });
    submitCommand(w, { tick: w.tick + 2, kind: 'sendBack', data: { pasture: first.id } });
    step(w, sim, 60);
    expect(lines(w, 'build.wantSet')[0]?.data['kind']).toBe(content.flock.pasture.name);
    expect(first['state']).toBe('sent');
    expect(hurdles(w, first.id)).toHaveLength(0);
    expect(lines(w, 'pasture.sentBack')).toHaveLength(1);
    const again = livePastures(w)[0]!;
    expect(again['sent']).toBe(1);
    const width = w.map.width;
    for (const i of [...grazingTiles(width, again), ...meadowTiles(width, again)])
      expect(onPastureGround(first, width, i % width, Math.floor(i / width))).toBe(false);
    submitCommand(w, { tick: w.tick + 1, kind: 'sendBack', data: { pasture: again.id } });
    step(w, sim, 60);
    expect(lines(w, 'command.refused').at(-1)?.data['reason']).toBe(
      'it was sent back once already',
    );
  });
});
