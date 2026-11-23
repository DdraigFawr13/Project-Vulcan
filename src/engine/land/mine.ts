// Mining (P4.1, V-086, V-087, V-041): nobody is ordered. While an ingot plate asks for a metal the
// colony has no ore for, a free person able for the `mine` job takes up whatever the shaft needs
// next: sinking it a level (a ladder of logs for the first), tunnelling toward the vein through
// open ground and then the cheapest rock or earth, or mining a vein tile they can get beside.
// Also digging clay for a wall that waits for it. Ore, rubble and clay lie where they come out
// and haulers carry them up (haul.ts). Taking up, each level, tile dug and vein mined are lines.
import { itemName, type EntityRow } from '../core/index.ts';
import { haveOf, layItem, stockOf, trailText, wantOf } from '../goods/index.ts';
import { diggable, layerOf, openAround, setTile } from '../map/index.ts';
import {
  metalsOf,
  nextDig,
  oreShort,
  saltCause,
  saltShort,
  searchDig,
  siteShaft,
  shaftFor,
  veinOpen,
} from '../mine/index.ts';
import { pack, reachFrom, unpack, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { cellarWork, dugCellar } from './cellar.ts';
import { clayWork } from './clay.ts';
import { ladderOf, laddered, sinking } from './shaft.ts';
import { practiseMining, start, stop, takenBy, type Kind, type Task } from './minetask.ts';
import { longPlanned, passedOver, planSeen, takingUp } from './minefar.ts';
import { able, declineIfUnable, goBeside, layAround, outranked, people } from '../band/index.ts';
import { couldHave, priorityLine, readyFor, spotOf, worked } from '../band/index.ts';

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
  const tiles = tilesOf(layer, f);
  for (let k = tiles.length - 1; k >= 0; k -= 1)
    if (layer.features[tiles[k]!] !== f) tiles.splice(k, 1);
  // Nearest first (ties in tile order): the first that can be stood beside is the one.
  const near = tiles
    .filter((i) => !taken.has(pack(map, { x: 0, y: 0, z }) + i))
    .map((i) => [
      Math.max(Math.abs((i % map.width) - here.x), Math.abs(Math.floor(i / map.width) - here.y)),
      i,
    ])
    .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
  const best = near.find(([, i]) => veinOpen(world, content, reach, f, i!));
  return best && pack(map, { x: best[1]! % map.width, y: Math.floor(best[1]! / map.width), z });
}

/** A search tunnel for `metal` (V-215): one at a time, from a shaft at its level, while none of
 * its seams is found; the task and its causes (the want and the shaft's plan). */
function searchFor(
  ctx: SystemContext,
  p: EntityRow,
  metal: string,
  causes: number[],
  others: EntityRow[],
): Omit<Task, 'what' | 'good' | 'have' | 'want' | 'word'> | undefined {
  const { world, content } = ctx;
  if (siteShaft(world, content, metal)) return undefined;
  // One search tunnel at a time.
  const searching = (q: EntityRow) =>
    q['task'] === 'tunnel' && !shaftFor(world, q['what'] as string);
  if (others.some(searching)) return undefined;
  const map = world.map;
  const size = map.width * map.height;
  const z = content.features.find((f) => f.id === metal)?.vein?.level ?? 0;
  const taken = new Set(
    [...takenBy(ctx, p)].filter((n) => Math.floor(n / size) === z).map((n) => n % size),
  );
  const dig = searchDig(ctx, metal, causes, taken);
  if (!dig) return undefined;
  const tile = unpack(map, z * size + dig.tile);
  return {
    ...(dig.fresh && { search: dig.fresh }),
    causes: [...causes, dig.shaft['line'] as number],
    kind: 'tunnel',
    plan: dig.shaft.id,
    target: pack(map, tile),
    minutes: content.work.mine.dig,
  };
}

/** What this person would do next, or undefined when nothing is wanted. */
function workFor(ctx: SystemContext, p: EntityRow): Task | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const mine = content.work.mine;
  const others = people(world).filter((q) => q.id !== p.id && q['job'] === 'mine');
  const saltId = content.work.cure.salt.item;
  let search: Task | undefined;
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
          good: itemName(content, def.yields!),
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
      mine.words[kind].replace('{m}', kind === 'mine' ? itemName(content, def.yields!) : metal);
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
    if (!shaft) {
      // A search tunnel waits for any known work below (V-215): the first ore that wants one.
      const found = search ? undefined : searchFor(ctx, p, metal, base.causes, others);
      if (found) search = { ...base, ...found, word: mine.words.search.replace('{m}', metal) };
      continue;
    }
    const mate = (kind: Kind) => others.some((q) => q['task'] === kind && q['plan'] === shaft.id);
    // The shaft's plan line is a cause of the taking up, after the plate's.
    const causes = [...base.causes, shaft['line'] as number];
    if (shaft['state'] !== 'done') {
      const ladder = shaft['depth'] === 0 ? ladderOf(content) : undefined;
      planSeen(ctx, shaft);
      if (mate('sink') || passedOver(ctx, shaft.id, p)) continue;
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
  return search ?? cellarWork(ctx, p) ?? clayWork(ctx, p);
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
  // A plan waiting `mine.wait` days goes to whoever is free, not only the best placed (V-227).
  const waited = t.kind === 'sink' && longPlanned(ctx, t.plan);
  const could = (q: EntityRow) => couldHave(ctx, q, job) && workFor(ctx, q) !== undefined;
  if (!waited && outranked(ctx, p, job, could)) return false;
  // A pick is needed (V-195): without one they knap their own or do other work.
  const tool = readyFor(ctx, p, job);
  if (tool !== 'ok') return tool === 'knap';
  p['took'] = ctx.emit('work.tookUp', {
    causes: [...t.causes, ...[priorityLine(world, p.id, job)].filter((l): l is number => !!l)],
    actors: [p.id],
    data: { name: p['name'] as string, work: t.word, good: t.good, have: t.have, want: t.want },
  });
  start(ctx, p, t);
  takingUp(ctx, p, t);
  return true;
}

/** Carries on with the same kind of task after one is done, without a new taking up. */
function carryOn(ctx: SystemContext, p: EntityRow): boolean {
  const t = workFor(ctx, p);
  if (!t || t.kind !== p['task'] || !couldHave(ctx, p, ctx.content.work.mine.job))
    return stop(ctx, p);
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
  worked(ctx, p, content.work.mine.job);
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
      data: { ...base, count, metal: feature.id, what: itemName(content, feature.yields) },
    });
  } else if (p['task'] === 'clay') {
    [item, count] = [kind.digs?.item, kind.digs?.count ?? 0];
    line = ctx.emit('mine.clayDug', {
      causes: [p['took'] as number],
      actors: [p.id],
      data: {
        ...base,
        count,
        where: at.z ? `on level ${at.z}` : 'at the clay bank',
        part: p['what'] as string,
      },
    });
  } else {
    [item, count] = [kind.digs?.item, kind.digs?.count ?? 0];
    const gave = item ? `: ${count} ${itemName(content, item)}` : '';
    line = ctx.emit('mine.dug', {
      causes: [p['took'] as number],
      actors: [p.id],
      data: { ...base, rock: kind.name, level: at.z, gave },
    });
  }
  // A clay bank dug on the surface leaves river sand (V-206).
  const floors = content.work.mine.floors;
  const floor = kind.stone ? floors.stone : at.z === 0 ? floors.bank : floors.earth;
  setTile(
    ctx,
    at.x,
    at.y,
    content.terrain.kinds.findIndex((k) => k.id === floor),
    line,
    at.z,
  );
  const fresh = darkVeins(ctx, at);
  openAround(ctx, at.x, at.y, at.z, line);
  for (const f of fresh) veinShown(ctx, p, f, at.z, line);
  if (p['task'] === 'tunnel') dugCellar(ctx, p, line);
  // A vein's ore keeps the tile it came from (P4.6): the step its ingots and tools carry on.
  const trail = feature?.yields
    ? trailText([{ s: 'mined', who: base.name, tick: world.tick, ...at, k: feature.yields }])
    : '';
  if (item && count) layYield(ctx, item, count, at, line, trail);
}

/** The veins round a dug tile that nobody knew of on its level (V-215): none of their tiles was
 * known there before. */
function darkVeins(ctx: SystemContext, at: Spot): number[] {
  const map = ctx.world.map;
  const layer = at.z > 0 ? map.levels[at.z - 1] : undefined;
  if (!layer) return [];
  const near = new Set<number>();
  for (let dy = -1; dy <= 1; dy += 1)
    for (let dx = -1; dx <= 1; dx += 1) {
      const [x, y] = [at.x + dx, at.y + dy];
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const i = y * map.width + x;
      if (layer.features[i] && !layer.known[i]) near.add(layer.features[i]!);
    }
  if (!near.size) return [];
  for (let i = 0; i < layer.features.length; i += 1)
    if (layer.known[i] && near.has(layer.features[i]!)) near.delete(layer.features[i]!);
  return [...near];
}

/** A vein shown for the first time on its level by digging beside it: one line. */
function veinShown(ctx: SystemContext, p: EntityRow, f: number, z: number, line: number): void {
  const def = ctx.content.features[f - 1]!;
  ctx.emit('mine.veinShown', {
    causes: [line],
    actors: [p.id],
    data: { name: p['name'] as string, metal: def.id, what: def.name, level: z },
  });
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
