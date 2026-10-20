// Placing the wild valley when a world begins (V-110): herds on open reachable ground of their
// biome, far from the start, and the one pack with its name and its den. All draws come from the
// `wild` stream, species by species in content order, then the pack.
import type { EntityRow, PredatorDef, RngStream, SpeciesDef, WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { isTree } from '../goods/index.ts';
import { reachFrom } from '../paths/index.ts';
import { valleyOf } from '../region/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { cap, distance, openAt, valleyName, whereWords } from './ground.ts';
import { packRow } from './wild.ts';

type Reach = (to: { x: number; y: number; z: number }) => boolean;

/** Lays herds and the pack in `init`, after the map and the people. */
export function placeWild(ctx: SystemContext): void {
  const { world, content } = ctx;
  const map = world.map;
  let open = 0;
  for (let i = 0; i < map.tiles.length; i += 1) {
    const kind = content.terrain.kinds[map.tiles[i]!]!;
    if (!kind.water && !kind.stone && !kind.solid) open += 1;
  }
  ctx.state['open'] = open;
  const reach = reachFrom(content, map, { x: map.startX, y: map.startY, z: 0 });
  const rng = ctx.rng();
  const centres: { x: number; y: number }[] = [];
  for (const sp of content.wild.species) {
    const { weight, cands } = habitatOf(ctx, sp, reach);
    const herds = Math.round(weight / 100 / sp.perHerd);
    for (let n = 0; n < herds && cands.length; n += 1) {
      let at = rng.pick(cands);
      const apart = (i: number): boolean =>
        centres.some(
          (c) =>
            distance(c.x, c.y, i % map.width, Math.floor(i / map.width)) < content.wild.place.apart,
        );
      for (let t = 1; t < content.wild.place.tries && apart(at); t += 1) at = rng.pick(cands);
      const [x, y] = [at % map.width, Math.floor(at / map.width)];
      centres.push({ x, y });
      const size = rng.between(sp.size[0]!, sp.size[1]!);
      const herd = addEntity(world, 'herd', {
        ...{ species: sp.id, x, y, radius: content.wild.place.radius, start: size },
        ...{ line: world.begunEvent, taken: 0, lost: 0, byPack: 0, bySnow: 0, low: 0 },
      });
      for (let k = 0; k < size; k += 1)
        spawn(ctx, rng, { herd, pack: 0, kind: sp.kinds[k % sp.kinds.length]!, x, y }, reach);
    }
  }
  settlePack(ctx, reach, packCause(world));
}

/** A species' habitat: its weighted biome tiles (the herd count) and the tiles a herd may be
 * placed on: open, far enough from the start, reachable from it, on the species' ground, and in
 * its biomes (or for a `foot` species, within that many tiles of them). */
function habitatOf(
  ctx: SystemContext,
  sp: SpeciesDef,
  reach: Reach,
): { weight: number; cands: number[] } {
  const { world, content } = ctx;
  const map = world.map;
  const habitat = new Map(
    sp.habitat.map((h) => [content.biomes.biomes.findIndex((b) => b.id === h.biome), h]),
  );
  const inHabitat = (x: number, y: number): boolean => {
    const r = sp.foot ?? 0;
    for (let ty = Math.max(0, y - r); ty <= Math.min(map.height - 1, y + r); ty += 1)
      for (let tx = Math.max(0, x - r); tx <= Math.min(map.width - 1, x + r); tx += 1)
        if (habitat.has(map.biomes[ty * map.width + tx]!)) return true;
    return false;
  };
  let weight = 0;
  const cands: number[] = [];
  for (let i = 0; i < map.tiles.length; i += 1) {
    const h = habitat.get(map.biomes[i]!);
    if (h) weight += h.weight;
    if (!h && !sp.foot) continue;
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    if (
      !openAt(content, map, i) ||
      distance(x, y, map.startX, map.startY) < content.wild.place.start
    )
      continue;
    if (sp.ground && !sp.ground.includes(content.terrain.kinds[map.tiles[i]!]!.id)) continue;
    if (sp.foot ? !inHabitat(x, y) : h!.edge && !treeWithin(ctx, x, y, h!.edge)) continue;
    if (reach({ x, y, z: 0 })) cands.push(i);
  }
  return { weight, cands };
}

/** The line a new pack cites: the valley's settling, or the world's beginning. */
const packCause = (world: WorldState): number =>
  world.log.find((e) => e.type === 'region.settled')?.id ?? world.begunEvent;

const treeWithin = (ctx: SystemContext, x: number, y: number, r: number): boolean => {
  const map = ctx.world.map;
  for (let ty = Math.max(0, y - r); ty <= Math.min(map.height - 1, y + r); ty += 1)
    for (let tx = Math.max(0, x - r); tx <= Math.min(map.width - 1, x + r); tx += 1)
      if (isTree(ctx.world, ctx.content, ty * map.width + tx)) return true;
  return false;
};

/** A new animal near (x, y): within `place.spread` on open ground the start can reach, else on it. */
function spawn(
  ctx: SystemContext,
  rng: RngStream,
  a: { herd: number; pack: number; kind: string; x: number; y: number },
  reach: Reach,
): void {
  const { world, content } = ctx;
  const map = world.map;
  const spread = content.wild.place.spread;
  let [x, y] = [a.x, a.y];
  for (let t = 0; t < 6; t += 1) {
    const [tx, ty] = [a.x + rng.between(-spread, spread), a.y + rng.between(-spread, spread)];
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
    if (openAt(content, map, ty * map.width + tx) && reach({ x: tx, y: ty, z: 0 })) {
      [x, y] = [tx, ty];
      break;
    }
  }
  addEntity(world, 'animal', {
    ...{ herd: a.herd, pack: a.pack, kind: a.kind, x, y, z: 0, path: [], stride: 0 },
    ...{ facing: rng.chance(0.5) ? 'e' : 'w', state: '', until: 0, hurt: 0 },
  });
}

/** The predator that takes the range: the first of content's whose creature lives in a biome the
 * valley has, else the last. */
function predatorFor(ctx: SystemContext): PredatorDef {
  const { content, world } = ctx;
  const present = new Set(world.map.biomes);
  const here = (p: PredatorDef): boolean =>
    !!content.creatures
      .find((c) => c.id === p.creature)
      ?.biomes.some((b) => present.has(content.biomes.biomes.findIndex((d) => d.id === b)));
  return content.wild.predators.find(here) ?? content.wild.predators.at(-1)!;
}

/** The wildest open tile at least `den.from` from the start: near trees, far from the band. */
function findDen(ctx: SystemContext, reach: Reach): { x: number; y: number } {
  const { content, world } = ctx;
  const map = world.map;
  const dials = content.wild.pack.den;
  for (const from of [dials.from, 0]) {
    let best = -1;
    let score = -1;
    for (let i = 0; i < map.tiles.length; i += 1) {
      const [x, y] = [i % map.width, Math.floor(i / map.width)];
      const d = distance(x, y, map.startX, map.startY);
      if (d < from || !openAt(content, map, i) || !reach({ x, y, z: 0 })) continue;
      let trees = 0;
      for (
        let ty = Math.max(0, y - dials.radius);
        ty <= Math.min(map.height - 1, y + dials.radius);
        ty += 1
      )
        for (
          let tx = Math.max(0, x - dials.radius);
          tx <= Math.min(map.width - 1, x + dials.radius);
          tx += 1
        )
          if (isTree(world, content, ty * map.width + tx)) trees += 1;
      if (trees + Math.min(d, dials.far) > score)
        [best, score] = [i, trees + Math.min(d, dials.far)];
    }
    if (best >= 0) return { x: best % map.width, y: Math.floor(best / map.width) };
  }
  return { x: map.startX, y: map.startY };
}

/**
 * Settles a pack on the range: at first from `init`, or again on a Thawmonth after one has left
 * (its row is reused, its den kept). Draws its size and name, lays its animals round the den and
 * writes `wild.packNamed` citing `cause`; returns the line.
 */
export function settlePack(ctx: SystemContext, reach: Reach, cause: number): number {
  const { world, content } = ctx;
  const rng = ctx.rng();
  const pred = predatorFor(ctx);
  const creature = content.creatures.find((c) => c.id === pred.creature)!;
  const near = valleyOf(world.seed, content)?.valley.near[0]?.name ?? content.wild.pack.near;
  const name = cap(rng.pick(creature.names).replace('{near}', near));
  const size = rng.between(pred.size[0]!, pred.size[1]!);
  let row: EntityRow | undefined = packRow(world);
  const den = row ? { x: row['denX'] as number, y: row['denY'] as number } : findDen(ctx, reach);
  if (!row) {
    const id = addEntity(world, 'pack', {
      ...{ species: '', name: '', size: 0, denX: den.x, denY: den.y, hunger: 0, lastKill: 0 },
      ...{ line: 0, attacked: 0, attackedAt: 0, attacks: 0, visits: 0, visitAt: 0, visiting: 0 },
      shown: 0,
      hungryLine: 0,
    });
    row = world.entities['pack']!.find((p) => p.id === id)!;
  }
  Object.assign(row, {
    ...{ species: pred.kind, name, size, hunger: 0, lastKill: world.tick, attacked: 0 },
    ...{ attacks: 0, attackedAt: 0, visits: 0, visitAt: 0, visiting: 0, shown: 0, hungryLine: 0 },
  });
  for (let k = 0; k < size; k += 1)
    spawn(ctx, rng, { herd: 0, pack: row.id, kind: pred.kind, x: den.x, y: den.y }, reach);
  const line = ctx.emit('wild.packNamed', {
    causes: [cause],
    data: {
      name,
      where: valleyName(world, content),
      what:
        size === 1
          ? `a ${pred.name}`
          : `${size} ${pred.kind === 'wolf' ? 'wolves' : `${pred.name}s`}`,
      den: whereWords(world, content, den.x, den.y),
    },
  });
  row['line'] = line;
  return line;
}
