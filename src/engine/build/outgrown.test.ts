// 6B review q4 (V-214): a home whose household outgrows it adds a room; when it can take no more
// rooms the household wants a bigger home, planned through the house wants and citing the line
// that said so, and once it stands they move and the old home is left free. Nobody is told to.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { allLines, createSim, createWorld, step, type EntityRow } from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { buildSystem, greenOf } from './index.ts';
import { homeFor } from './beds.ts';
import { placeHouse } from './houses.ts';
import { planHomes } from './homes.ts';
import { chooseHouse, housesOf } from './site.ts';

type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** A built lean-to home for the first woman and man of the band, partners, and a child of
 * theirs: three in a home that sleeps two. `rooms` is `house.private`, the most rows it may have. */
function crowded(rooms: number) {
  const house = { ...game.buildings.house, private: rooms };
  const sim = createSim({ ...game, buildings: { ...game.buildings, house } });
  const w = createWorld(sim, 'smoke');
  step(w, sim, 60);
  const ctx = contextFor(w, sim, buildSystem);
  const green = greenOf(w);
  const people = (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
  const p = people.find((x) => x['sex'] === 'f')!;
  const q = people.find((x) => x['sex'] === 'm')!;
  [p['partner'], q['partner']] = [q.id, p.id];
  const kid = people.find((x) => x !== p && x !== q)!;
  kid['household'] = p.id;
  const leanTo = house.sizes.find((s) => s.id === 'lean-to')!;
  const pick = chooseHouse(w, sim.content, green, 2, undefined, { sizes: [leanTo] })!;
  const id = placeHouse(ctx, pick.site, leanTo, pick.wall, 1, { why: 'test', owner: p.id });
  const home = housesOf(w).find((h) => h.id === id)!;
  Object.assign(home, { state: 'built', built: 1, tried: -1e9 });
  for (const x of [p, q, kid]) x['wants'] = 1;
  return { w, ctx, green, home, ids: [p.id, q.id, kid.id] };
}

describe('a home outgrown', () => {
  it('adds a room while it may, citing the home', () => {
    const { w, ctx, green, home } = crowded(4);
    planHomes(ctx, green);
    const grows = lines(w, 'build.grows').at(-1)!;
    expect(grows.data['sleepers']).toBe(3);
    expect(housesOf(w).some((h) => h['of'] === home.id && h['state'] === 'plan')).toBe(true);
    expect(lines(w, 'build.homeOutgrown')).toHaveLength(0);
  });

  it('with no room to add, the household wants a bigger home, gets it and leaves the old', () => {
    const { w, ctx, green, home, ids } = crowded(1);
    planHomes(ctx, green);
    const outgrown = lines(w, 'build.homeOutgrown').at(-1)!;
    expect(outgrown.actors).toEqual(expect.arrayContaining(ids));
    expect(home['outgrown']).toBe(outgrown.id);
    const sited = lines(w, 'build.homeSited').at(-1)!;
    expect(sited.causes).toContain(outgrown.id);
    const next = housesOf(w).find((h) => h.id !== home.id && h['owner'] && !h['of']) as EntityRow;
    expect(next['state']).toBe('plan');
    // Until it stands they keep the old home; once it does, they move and the old stands free.
    expect(homeFor(w, ids[0]!)?.id).toBe(home.id);
    next['state'] = 'built';
    planHomes(ctx, green);
    expect(lines(w, 'build.homeLeft').at(-1)!.causes).toContain(outgrown.id);
    expect(home['owner']).toBe(0);
    expect(homeFor(w, ids[0]!)?.id).toBe(next.id);
  });
});
