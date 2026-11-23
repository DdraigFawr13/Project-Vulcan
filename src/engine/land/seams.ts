// Spotting a seam (6W Slice 7, V-215): ore shows in a rock face as a seam, and nothing marks it
// from afar. Each hour anyone awake on the surface beside a face over a seam not yet found may
// see it: 1 in `prospect.per`, plus as much again for each level of mining, times the face's rock
// by the ore's `vein.rocks` (`rockOdds`). A prospector out for it is likeliest, but a novice
// herding past may stumble on one. The seam becomes a found place (V-213's flag and tile page)
// that the mine plans a shaft beside, however far off. Rolls draw from their own `seams` stream,
// so no other stream shifts.
import { itemName, streamFor, type EntityRow, type Place } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { compass, rockOdds, seamAt } from '../map/index.ts';
import {
  metalsOf,
  openVein,
  oreShort,
  saltShort,
  seamsOf,
  shaftFor,
  siteShaft,
} from '../mine/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { people, skillOf } from '../band/index.ts';
import { isDown } from '../health/index.ts';
import { apart } from './camp.ts';

/** The seam a person beside a face could spot: the best odds among the faces round them, ties to
 * the lower tile; none found within `apart` of one of its ore already found. */
function faceBeside(
  ctx: SystemContext,
  p: EntityRow,
): { i: number; f: number; odds: number } | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const def = content.work.scout.prospect;
  const [x, y] = [p['x'] as number, p['y'] as number];
  let best: { i: number; f: number; odds: number } | undefined;
  for (let dy = -1; dy <= 1; dy += 1)
    for (let dx = -1; dx <= 1; dx += 1) {
      const [fx, fy] = [x + dx, y + dy];
      if (fx < 0 || fy < 0 || fx >= map.width || fy >= map.height) continue;
      const i = fy * map.width + fx;
      const f = seamAt(map, i);
      const vein = f ? content.features[f - 1]!.vein : undefined;
      if (!vein?.seam) continue;
      if (seamFound(ctx, f, i)) continue;
      const rock = content.terrain.kinds[map.tiles[i]!]!.id;
      const odds = rockOdds(vein, rock, def.rocks);
      if (!best || odds > best.odds) best = { i, f, odds };
    }
  return best;
}

/** A person's skill at the mine job's skill (mining). */
export const miningOf = (ctx: SystemContext, p: EntityRow): number => {
  const job = ctx.content.jobs.find((j) => j.id === ctx.content.work.mine.job);
  return job?.skill ? skillOf(ctx.world, p, job.skill) : 0;
};

/** Each minute, the seam face beside each person awake on the surface is noted (the best odds in
 * the hour); each hour, a quarter past, whoever stood beside one may spot it. */
export function seamHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  const state = (world.systems['seams'] ??= {});
  const def = content.work.scout.prospect;
  const roll = world.tick % 60 === 15;
  for (const p of people(world)) {
    if (p['status'] !== 'alive' || p['z'] !== 0 || p['doing'] === 'sleep') continue;
    if (isDown(world, p.id)) continue;
    const face = faceBeside(ctx, p);
    // Odds kept in hundredths, the face as 1 + its tile.
    if (face && face.odds * 100 > (state[`o${p.id}`] ?? 0))
      [state[`o${p.id}`], state[`f${p.id}`]] = [face.odds * 100, face.i + 1];
    if (!roll || !state[`f${p.id}`]) continue;
    const i = state[`f${p.id}`]! - 1;
    const odds = state[`o${p.id}`]! / 100;
    [state[`o${p.id}`], state[`f${p.id}`]] = [0, 0];
    const f = seamAt(world.map, i);
    if (!f || seamFound(ctx, f, i)) continue;
    // Out of 10,000: (1 + level) in `per`, times the rock.
    const chance = Math.round(((1 + miningOf(ctx, p)) * odds * 10000) / def.per);
    if (streamFor(world, 'seams').int(10000) >= chance) continue;
    spotted(ctx, p, i, f);
  }
}

/** Whether a seam of the vein `f` is already found within `prospect.apart` of face `i`. */
function seamFound(ctx: SystemContext, f: number, i: number): boolean {
  const map = ctx.world.map;
  const [x, y] = [i % map.width, Math.floor(i / map.width)];
  const id = ctx.content.features[f - 1]!.id;
  const apartBy = ctx.content.work.scout.prospect.apart;
  return seamsOf(ctx.world, id).some((s) => apart(s.x, s.y, x, y) <= apartBy);
}

/** The ore's name in words: its item without "ore" ("copper", "salt"). */
export const oreWord = (ctx: SystemContext, f: number): string =>
  itemName(ctx.content, ctx.content.features[f - 1]!.yields).replace(/ ore$/, '');

/** A seam spotted: a found place and one line, citing the trip that went for it, else whatever
 * the finder was about. */
function spotted(ctx: SystemContext, p: EntityRow, i: number, f: number): void {
  const { world, content } = ctx;
  const map = world.map;
  const [x, y] = [i % map.width, Math.floor(i / map.width)];
  const feature = content.features[f - 1]!;
  const trip = map.finds.at(-1);
  const looking = trip?.count === -1 && trip.ore === 1 && trip.who === p.id;
  const cause = looking ? trip.line : ((p['took'] as number) ?? 0);
  const g = greenOf(world);
  const line = ctx.emit('land.seamSpotted', {
    causes: cause > 0 ? [cause] : [],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      colour: feature.vein!.seam!,
      ore: oreWord(ctx, f),
      rock: content.terrain.kinds[map.tiles[i]!]!.name,
      far: apart(x, y, g.x, g.y),
      dir: compass(x - g.x, y - g.y),
      aside: looking || trip?.good === feature.id ? '' : ' Nobody was looking for it.',
    },
  });
  const kind = content.work.scout.places.kinds.find((k) => k.use === 'ore')?.id ?? 'seam';
  const place: Place = { kind, x, y, by: p.id, line, tick: world.tick, what: feature.id };
  map.places.push(place);
}

/** The ore a prospector would go for: its feature id and index, and how much is short. */
export interface OreNeed {
  metal: string;
  f: number;
  short: number;
}

/** The ores a seam shows for, in content order: the `word` index of ore `k` is goods + k. */
export const seamOres = (ctx: SystemContext): string[] =>
  ctx.content.features.flatMap((f) => (f.vein?.seam ? [f.id] : []));

/** Whether the colony knows where to get `metal`: a seam found that a shaft can be sited by, a vein shown
 * that it can get beside, or a shaft going for it. */
export const oreKnown = (ctx: SystemContext, metal: string): boolean =>
  !!shaftFor(ctx.world, metal) ||
  siteShaft(ctx.world, ctx.content, metal) !== undefined ||
  openVein(ctx.world, ctx.content, metal);

/** The ores wanted and unknown, in content order (metals, then the cure's salt). */
export function oresWanted(ctx: SystemContext): OreNeed[] {
  const { world, content } = ctx;
  const salt = content.work.cure.salt.item;
  const out: OreNeed[] = [];
  for (const metal of [...metalsOf(content), salt]) {
    const f = content.features.findIndex((d) => d.id === metal) + 1;
    if (!f || !content.features[f - 1]!.vein?.seam) continue;
    const short = metal === salt ? saltShort(world, content) : oreShort(world, content, metal);
    if (short > 0 && !oreKnown(ctx, metal)) out.push({ metal, f, short });
  }
  return out;
}
