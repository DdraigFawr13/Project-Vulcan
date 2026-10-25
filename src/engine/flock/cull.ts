// The flock's shearing, the autumn cull and what the rick cannot feed (P5.4b): which animals are
// marked to be butchered, in what order, and the shearing and butchery themselves.
import { clockAt, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import { layItem } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { killAnimal, speciesOf } from '../wild/index.ts';
import {
  animalWord,
  articleOf,
  daysTo,
  headOf,
  keptOf,
  kindDef,
  speciesId,
  whoName,
} from './flock.ts';

/** Younger first: a later birth, then (for the tamed grown, born 0) a later id. */
const youngerFirst = (a: EntityRow, b: EntityRow): number =>
  (b['born'] as number) - (a['born'] as number) || b.id - a.id;

/** Animals marked to cull, the oldest mark first. */
export const marked = (world: WorldState, flock: EntityRow): EntityRow[] =>
  keptOf(world, flock)
    .filter((a) => a['cull'])
    .sort((a, b) => (a['cull'] as number) - (b['cull'] as number) || a.id - b.id);

/** Grown fleece animals not shorn this year, in the shearing month. */
export function shearable(
  world: WorldState,
  content: EngineContent,
  flock: EntityRow,
): EntityRow[] {
  const clock = clockAt(world.tick, content.calendar);
  if (content.calendar.monthNames[clock.month] !== content.flock.shear.month) return [];
  return keptOf(world, flock).filter(
    (a) =>
      !a['young'] && a['shorn'] !== clock.year + 1 && kindDef(content, speciesId(world, a)).fleece,
  );
}

/** Shears an animal: `shear.count` of `shear.item` lie where it stands; `flock.shorn`. */
export function shear(
  ctx: SystemContext,
  flock: EntityRow,
  animal: EntityRow,
  byPerson: number,
): number {
  const { world, content } = ctx;
  const def = content.flock.shear;
  animal['shorn'] = clockAt(world.tick, content.calendar).year + 1;
  const cause = flock['line'] as number;
  const line = ctx.emit('flock.shorn', {
    actors: byPerson ? [byPerson] : [],
    causes: cause ? [cause] : [],
    data: { who: whoName(world, byPerson), count: def.count },
  });
  layItem(world, {
    kind: def.item,
    count: def.count,
    x: animal['x'] as number,
    y: animal['y'] as number,
    z: 0,
    made: line,
  });
  flock['line'] = line;
  return line;
}

/** Butchers a marked animal: `flock.butchered`, then its meat (`cull.item`), leftovers and offal lie
 * where it stood. Returns the line. */
export function butcher(
  ctx: SystemContext,
  flock: EntityRow,
  animal: EntityRow,
  byPerson: number,
): number {
  const { world, content } = ctx;
  const word = animalWord(content, animal);
  const cause = (flock['cullLine'] as number) || (flock['line'] as number);
  const line = ctx.emit('flock.butchered', {
    actors: byPerson ? [byPerson] : [],
    causes: cause ? [cause] : [],
    data: {
      who: whoName(world, byPerson),
      a: articleOf(word),
      kind: word,
      meat: speciesOf(content, speciesId(world, animal)).meat,
    },
  });
  killAnimal(ctx, animal, byPerson, line, 'wild.killed', content.flock.cull.item);
  flock['line'] = line;
  return line;
}

/** Marks `animal` to cull now. */
const mark = (world: WorldState, a: EntityRow): void => {
  a['cull'] = world.tick;
};

/** The autumn count: keep `min(head, floor(hay / hay.plan))`. Rams first, one grown male per
 * `ramsPer` grown females and at least one while any female is kept; then females, youngest first;
 * then males. The rest are marked. Writes `flock.cullSet` when any are. */
export function setCull(ctx: SystemContext, flock: EntityRow): void {
  const { world, content } = ctx;
  const all = keptOf(world, flock);
  const keep = Math.min(all.length, Math.floor((flock['hay'] as number) / content.flock.hay.plan));
  const females = all.filter((a) => a['sex'] === 'f').sort(youngerFirst);
  const males = all.filter((a) => a['sex'] === 'm').sort(youngerFirst);
  const grownFemales = females.filter((a) => !a['young']).length;
  const kept = new Set<number>();
  const take = (rows: readonly EntityRow[], n: number): void => {
    for (const a of rows) if (kept.size < keep && n-- > 0) kept.add(a.id);
  };
  const rams = Math.max(1, Math.ceil(grownFemales / content.flock.cull.ramsPer));
  take(
    males.filter((a) => !a['young']),
    grownFemales ? rams : 0,
  );
  take(females, females.length);
  take(males, males.length);
  const out = all.filter((a) => !kept.has(a.id) && !a['cull']);
  if (!out.length) return;
  for (const a of out) mark(world, a);
  const cause = flock['line'] as number;
  flock['cullLine'] = flock['line'] = ctx.emit('flock.cullSet', {
    causes: cause ? [cause] : [],
    data: { hay: flock['hay'] as number, keep, cull: out.length },
  });
}

/** On hay with too little to reach the thaw: the youngest are marked until what is left of the
 * rick feeds the rest. Writes `flock.cullEarly` when any are marked. */
export function cullEarly(ctx: SystemContext, flock: EntityRow): void {
  const { world, content } = ctx;
  const days = daysTo(world, content, content.flock.hay.thaw);
  const all = keptOf(world, flock);
  const fed = Math.floor((flock['hay'] as number) / days);
  const open = all.filter((a) => !a['cull']);
  if (open.length <= fed) return;
  const out = open.sort(youngerFirst).slice(0, open.length - fed);
  for (const a of out) mark(world, a);
  const cause = flock['line'] as number;
  flock['cullLine'] = flock['line'] = ctx.emit('flock.cullEarly', {
    causes: cause ? [cause] : [],
    data: {
      ...{ hay: flock['hay'] as number, head: headOf(world, flock), days },
      ...{ thaw: content.flock.hay.thaw, cull: out.length },
    },
  });
}

/** The rick is empty: one animal starves, a marked one first, else the youngest. */
export function starve(ctx: SystemContext, flock: EntityRow): void {
  const { world, content } = ctx;
  const all = keptOf(world, flock);
  if (!all.length) return;
  const victim = marked(world, flock)[0] ?? all.sort(youngerFirst)[0]!;
  const word = animalWord(content, victim);
  const cause = flock['line'] as number;
  const line = ctx.emit('flock.starved', {
    causes: cause ? [cause] : [],
    data: { a: articleOf(word), kind: word },
  });
  killAnimal(ctx, victim, 0, line);
  flock['line'] = line;
}
