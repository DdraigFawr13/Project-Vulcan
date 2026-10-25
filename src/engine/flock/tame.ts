// Taking wild sheep and goats into the flock, and shutting the flock in or letting it out (P5.4b).
// The herders choose the work (people `herd.ts`); nothing here names a tile (V-041).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { foldRect } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { animalsOf, herdOf, spareCount, tameAnimal, wildHerdsOf } from '../wild/index.ts';
import { articleOf, headOf, keptHerds, kindDef, monthNow, pastureOf, whoName } from './flock.ts';

/** Room left in the pasture and a month in which the herders tame. */
export function canTame(world: WorldState, content: EngineContent, flock: EntityRow): boolean {
  return (
    headOf(world, flock) < content.flock.pasture.holds &&
    content.flock.tame.months.includes(monthNow(world, content).name)
  );
}

/** Wild herds of a tameable species with more than `wild.spare` animals within `tame.reach` of the
 * pasture, nearest first (ties by id). */
export function tameTargets(
  world: WorldState,
  content: EngineContent,
  flock: EntityRow,
): EntityRow[] {
  const p = pastureOf(world, flock);
  const [px, py] = [
    (p['x'] as number) + (p['w'] as number) / 2,
    (p['y'] as number) + (p['h'] as number) / 2,
  ];
  const dist = (h: EntityRow) =>
    Math.max(Math.abs((h['x'] as number) - px), Math.abs((h['y'] as number) - py));
  const size = new Map<number, number>();
  for (const a of animalsOf(world))
    size.set(a['herd'] as number, (size.get(a['herd'] as number) ?? 0) + 1);
  return wildHerdsOf(world)
    .filter(
      (h) =>
        content.flock.tame.species.includes(h['species'] as string) &&
        (size.get(h.id) ?? 0) > spareCount(content) &&
        dist(h) <= content.flock.tame.reach,
    )
    .sort((a, b) => dist(a) - dist(b) || a.id - b.id);
}

/** The flock's kept herd of a species, made on the first taming or birth of that species. */
export function keptHerdFor(ctx: SystemContext, flock: EntityRow, species: string): number {
  const { world } = ctx;
  const have = keptHerds(world, flock).find((h) => h['species'] === species);
  if (have) return have.id;
  const f = foldRect(pastureOf(world, flock));
  return addEntity(world, 'herd', {
    ...{
      species,
      x: f.x,
      y: f.y,
      radius: 0,
      start: 0,
      line: (flock['line'] as number) || world.begunEvent,
    },
    ...{ taken: 0, lost: 0, byPack: 0, bySnow: 0, low: 0, kept: flock['pasture'] as number },
  });
}

/**
 * The herders bring a wild animal into the flock because of the line `cause`: a lamb in a taming
 * month for young animals (`tame.young`), else a grown one. Never from a herd at `wild.spare`.
 * Writes `flock.tamed`, or `flock.full` (once, until room is made) at the pasture's `holds`; returns
 * the line, or 0 when nothing was written.
 */
export function takeIn(
  ctx: SystemContext,
  flock: EntityRow,
  animal: EntityRow,
  byPerson: number,
  cause: number,
): number {
  const { world, content } = ctx;
  const herd = herdOf(world, animal['herd'] as number);
  if (!herd || herd['kept']) return 0;
  const left = animalsOf(world).filter((a) => a['herd'] === herd.id).length;
  if (left <= spareCount(content)) return 0;
  const causes = [cause || (flock['line'] as number)].filter((c) => c > 0);
  if (headOf(world, flock) >= content.flock.pasture.holds) {
    if (flock['full']) return 0;
    flock['full'] = 1;
    return (flock['line'] = ctx.emit('flock.full', { actors: byPerson ? [byPerson] : [], causes }));
  }
  const species = herd['species'] as string;
  const kd = kindDef(content, species);
  const sex =
    animal['kind'] === kd.male
      ? 'm'
      : animal['kind'] === kd.female
        ? 'f'
        : animal.id % 3 === 0
          ? 'm'
          : 'f';
  const young = content.flock.tame.young.includes(monthNow(world, content).name);
  const kind = young ? kd.young : sex === 'm' ? kd.male : kd.female;
  const word = young ? kd.youngName : sex === 'm' ? kd.maleName : kd.femaleName;
  const line = ctx.emit('flock.tamed', {
    actors: byPerson ? [byPerson] : [],
    causes,
    data: { who: whoName(world, byPerson), a: articleOf(word), kind: word, species: kd.species },
  });
  const keptId = keptHerdFor(ctx, flock, species);
  tameAnimal(
    ctx,
    animal,
    keptId,
    { kind, sex, young: young ? 1 : 0, born: young ? world.tick : 0, tamedBy: byPerson },
    line,
  );
  flock['line'] = line;
  return line;
}

/** The flock is shut in the fold (nobody names who; the people side writes its own lines). */
export function foldFlock(_ctx: SystemContext, flock: EntityRow, _byPerson: number): void {
  flock['folded'] = 1;
}

/** The flock is let out onto the pasture. */
export function openFlock(_ctx: SystemContext, flock: EntityRow, _byPerson: number): void {
  flock['folded'] = 0;
}

/** A grown animal of `species` a newcomer brings (P5.9) joins the first flock at its fold; false
 * when the colony has no flock yet. */
export function bringIn(ctx: SystemContext, species: string, sex: string): boolean {
  const { world, content } = ctx;
  const flock = (world.entities['flock'] ?? [])[0];
  const kd = content.flock.kinds.find((k) => k.species === species);
  if (!flock || !kd) return false;
  const f = foldRect(pastureOf(world, flock));
  addEntity(world, 'animal', {
    ...{ herd: keptHerdFor(ctx, flock, species), pack: 0, kind: sex === 'm' ? kd.male : kd.female },
    ...{ x: f.x + 1, y: f.y + 1, z: 0, path: [], stride: 0, facing: 'e', state: '', until: 0 },
    ...{ hurt: 0, sex, born: 0, young: 0, tamedBy: 0, cull: 0, shorn: 0, dies: 0 },
  });
  return true;
}
