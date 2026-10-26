// Mining (P4.1, V-086, V-087, V-041): nobody is ordered. While an ingot plate asks for a metal the
// colony has no ore for, a free person able for the `mine` job takes up whatever the shaft needs
// next: sinking it a level (a ladder of logs for the first), tunnelling toward the vein through
// open ground and then the cheapest rock or earth, or mining a vein tile they can get beside.
// Also digging clay for a wall that waits for it. Ore, rubble and clay lie where they come out
// and haulers carry them up (haul.ts). Taking up, each level, tile dug and vein mined are lines.
import type { EntityRow } from '../core/index.ts';
import { haveOf, layItem, stockOf, trailText, wantOf } from '../goods/index.ts';
import { diggable, layerOf, openAround, setTile } from '../map/index.ts';
import {
  metalsOf,
  nextDig,
  oreShort,
  saltCause,
  saltShort,
  shaftFor,
  veinOpen,
} from '../mine/index.ts';
import { pack, reachFrom, unpack, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { cellarWork, dugCellar } from './cellar.ts';
import { clayWork } from './clay.ts';
import { ladderOf, laddered, sinking } from './shaft.ts';
import { nameOf, practiseMining, start, stop, takenBy, type Kind, type Task } from './minetask.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { goBeside, layAround, people, spotOf } from './spots.ts';

/** The tiles of each metal's vein on each level, found once: a vein tile is only ever mined away
 * (never grown), so a cached tile that no longer holds the vein is dropped as it is met. */
const veinTiles = new WeakMap<object, Map<number, number[]>>();
function tilesOf(layer: { features: ArrayLike<number> }, f: number): number[] {
  let byMetal = veinTiles.get(layer);
  if (!byMetal) veinTiles.set(layer, (byMetal = new Map()));
  let tiles = byMetal.get(f);
  if (!tiles) {
    byMetal.set(f, (tiles = []));
    for (let i = 0; i < layer.features.length; i += 1) if (layer.features[i] === f) tiles.push(i);
  }
  return tiles;
}

/** The nearest vein tile of `metal` someone can get beside (`veinOpen`), as a packed node. */
function veinFor(ctx: SystemContext, p: EntityRow, metal: string): number | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const f = content.features.findIndex((d) => d.id === metal) + 1;
  const z = content.features[f - 1]?.vein?.level ?? 0;
  const layer = map.levels[z - 1];
  if (!layer) return undefined;
  const taken = takenBy(ctx, p);
  const here = spotOf(p);
  const reach = reachFrom(content, map, here);
  let best: number | undefined;
  let score = Infinity;
  const tiles = tilesOf(layer, f);
  for (let k = tiles.length - 1; k >= 0; k -= 1)
    if (layer.features[tiles[k]!] !== f) tiles.splice(k, 1);
  for (const i of tiles) {
    if (taken.has(pack(map, { x: 0, y: 0, z }) + i)) continue;
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    const d = Math.max(Math.abs(x - here.x), Math.abs(y - here.y)) * 1000000 + i;
    if (d < score && veinOpen(world, content, reach, f, i))
      [best, score] = [pack(map, { x, y, z }), d];
  }
  return best;
}

/** What this person would do next, or undefined when nothing is wanted. */
function workFor(ctx: SystemContext, p: EntityRow): Task | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const mine = content.work.mine;
  const others = people(world).filter((q) => q.id !== p.id && q['job'] === 'mine');
  const saltId = content.work.cure.salt.item;
  for (const metal of [...metalsOf(content), saltId]) {
    const def = content.features.find((f) => f.id === metal)!;
    const salt = metal === saltId;
    const coming = others.filter((q) => q['task'] === 'mine' && q['what'] === metal).length;
    const short = salt ? saltShort(world, content) : oreShort(world, content, metal);
    if (short - coming * def.amount <= 0) continue;
    const ingot = `${metal}-ingot`;
    const plate = stockOf(world, ingot);
    // Salt is wanted by the curer, not a plate: its causes are the curer's lines (mine/salt.ts).
    const base = salt
      ? {
          what: metal,
          causes: [saltCause(world)].filter(Boolean),
          good: nameOf(content, def.yields!),
          have: haveOf(world, content, def.yields!),
          want: content.work.cure.salt.per,
        }
      : {
          what: metal,
          causes: [(plate?.['line'] as number) ?? 0].filter(Boolean),
          good: content.work.stock.find((s) => s.good === ingot)?.name ?? ingot,
          have: haveOf(world, content, ingot),
          want: wantOf(world, content, ingot),
        };
    const word = (kind: Kind): string =>
      mine.words[kind].replace('{m}', kind === 'mine' ? nameOf(content, def.yields!) : metal);
    const vein = veinFor(ctx, p, metal);
    if (vein !== undefined)
      return {
        ...base,
        kind: 'mine',
        plan: 0,
        target: vein,
        minutes: mine.vein,
        word: word('mine'),
      };
    const shaft = shaftFor(world, metal);
    if (!shaft) continue;
    const mate = (kind: Kind) => others.some((q) => q['task'] === kind && q['plan'] === shaft.id);
    // The shaft's plan line is a cause of the taking up, after the plate's.
    const causes = [...base.causes, shaft['line'] as number];
    if (shaft['state'] !== 'done') {
      const ladder = shaft['depth'] === 0 ? ladderOf(content) : undefined;
      if (mate('sink')) continue;
      if (ladder && !laddered(ctx, p, metal, ladder, base.causes[0])) continue;
      return {
        ...base,
        causes,
        kind: 'sink',
        plan: shaft.id,
        target: -1,
        minutes: mine.shaft,
        word: word('sink'),
      };
    }
    if (mate('tunnel')) continue;
    const z = shaft['to'] as number;
    const size = map.width * map.height;
    const taken = new Set(
      [...takenBy(ctx, p)].filter((n) => Math.floor(n / size) === z).map((n) => n % size),
    );
    const dig = nextDig(
      world,
      content,
      { x: shaft['x'] as number, y: shaft['y'] as number, z },
      metal,
      taken,
    );
    if (!dig) continue;
    const tile = unpack(map, z * size + dig.tile);
    const minutes = layerOf(map, z)!.features[dig.tile] ? mine.vein : mine.dig;
    return {
      ...base,
      causes,
      kind: 'tunnel',
      plan: shaft.id,
      target: pack(map, tile),
      minutes,
      word: word('tunnel'),
    };
  }
  return cellarWork(ctx, p) ?? clayWork(ctx, p);
}

/** Mining, while an ingot plate is short of ore the colony cannot feed from an open vein, or a
 * wall waits for clay, unless they are not able (and say so if the player raised it for them) or
 * someone free puts it higher. */
export function takeUpMining(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const t = workFor(ctx, p);
  if (!t) return false;
  const job = content.work.mine.job;
  if (!able(content, p, job)) {
    declineIfUnable(ctx, p, job);
    return false;
  }
  if (outranked(ctx, p, job, (q) => workFor(ctx, q) !== undefined)) return false;
  p['took'] = ctx.emit('work.tookUp', {
    causes: [...t.causes, ...[priorityLine(world, p.id, job)].filter((l): l is number => !!l)],
    actors: [p.id],
    data: { name: p['name'] as string, work: t.word, good: t.good, have: t.have, want: t.want },
  });
  start(ctx, p, t);
  return true;
}

/** Carries on with the same kind of task after one is done, without a new taking up. */
function carryOn(ctx: SystemContext, p: EntityRow): boolean {
  const t = workFor(ctx, p);
  if (!t || t.kind !== p['task']) return stop(ctx, p);
  start(ctx, p, t);
  return true;
}

/** One minute of mining for someone who has taken it up; false when the task ended. */
export function mining(ctx: SystemContext, p: EntityRow): boolean {
  if (p['task'] === 'sink') return sinking(ctx, p);
  const { world, content } = ctx;
  const map = world.map;
  const target = p['target'] as number;
  if (target < 0) return stop(ctx, p);
  const { x, y, z } = unpack(map, target);
  const layer = layerOf(map, z);
  const i = y * map.width + x;
  // The tile must still be rock or earth (a vein tile still holds its vein). A tunnel's next tile
  // not yet shown may be open ground instead (a cave, water): it is only shown, below.
  const kind = layer && content.terrain.kinds[layer.tiles[i]!];
  if (!layer || !kind) return stop(ctx, p);
  const unseen = p['task'] === 'tunnel' && !map.levels[z - 1]?.known[i] && !diggable(kind);
  if (!diggable(kind) && !unseen) return stop(ctx, p);
  if (p['task'] === 'mine' && !layer.features[i]) return stop(ctx, p);
  const here = spotOf(p);
  if (here.z !== z || Math.abs(here.x - x) + Math.abs(here.y - y) !== 1)
    return goBeside(ctx, p, x, y, z) || stop(ctx, p);
  if (unseen) {
    // Nothing to dig: standing beside it shows it, and the way is found again.
    openAround(ctx, x, y, z, p['took'] as number);
    return carryOn(ctx, p);
  }
  p['work'] = (p['work'] as number) - 1;
  practiseMining(ctx, p);
  if ((p['work'] as number) > 0) return true;
  dig(ctx, p, { x, y, z });
  return carryOn(ctx, p);
}

/** The tile is dug out (or the vein mined): floor is left, what it gives lies there, the ground
 * around it is shown. */
function dig(ctx: SystemContext, p: EntityRow, at: Spot): void {
  const { world, content } = ctx;
  const map = world.map;
  const layer = layerOf(map, at.z)!;
  const i = at.y * map.width + at.x;
  const kind = content.terrain.kinds[layer.tiles[i]!]!;
  const feature = layer.features[i] ? content.features[layer.features[i]! - 1] : undefined;
  const base = { name: p['name'] as string };
  let line: number;
  let item: string | undefined;
  let count = 0;
  if (feature?.yields) {
    [item, count] = [feature.yields, feature.amount];
    line = ctx.emit('mine.veinMined', {
      causes: [p['took'] as number],
      actors: [p.id],
      data: { ...base, count, metal: feature.id, what: nameOf(content, feature.yields) },
    });
  } else if (p['task'] === 'clay') {
    [item, count] = [kind.digs?.item, kind.digs?.count ?? 0];
    line = ctx.emit('mine.clayDug', {
      causes: [p['took'] as number],
      actors: [p.id],
      data: { ...base, count, level: at.z, part: p['what'] as string },
    });
  } else {
    [item, count] = [kind.digs?.item, kind.digs?.count ?? 0];
    const gave = item ? `: ${count} ${nameOf(content, item)}` : '';
    line = ctx.emit('mine.dug', {
      causes: [p['took'] as number],
      actors: [p.id],
      data: { ...base, rock: kind.name, level: at.z, gave },
    });
  }
  const floor = kind.stone ? content.work.mine.floors.stone : content.work.mine.floors.earth;
  setTile(
    ctx,
    at.x,
    at.y,
    content.terrain.kinds.findIndex((k) => k.id === floor),
    line,
    at.z,
  );
  openAround(ctx, at.x, at.y, at.z, line);
  if (p['task'] === 'tunnel') dugCellar(ctx, p, line);
  // A vein's ore keeps the tile it came from (P4.6): the step its ingots and tools carry on.
  const trail = feature?.yields
    ? trailText([{ s: 'mined', who: base.name, tick: world.tick, ...at, k: feature.yields }])
    : '';
  if (item && count) layYield(ctx, item, count, at, line, trail);
}

/** Lays what the digging gave on the open ground around the tile; whatever finds no free tile
 * lies on the dug tile itself, on top of a stack if one is there: nothing vanishes. */
export function layYield(
  ctx: SystemContext,
  item: string,
  count: number,
  at: Spot,
  made: number,
  trail = '',
) {
  const left = count - layAround(ctx, item, count, at, made, trail);
  if (left > 0) layItem(ctx.world, { kind: item, count: left, ...at, made }, { trail });
}
