// An animal killed by a person (or, later, by a fight): it is removed and lies where it fell as
// game, its species' leftovers and a piece of offal, owned by nobody, each citing the kill's line.
import type { EntityRow } from '../core/index.ts';
import { removeEntity } from '../entity/index.ts';
import { freeTile, layItem, stackSize } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { checkLow } from './daily.ts';
import { whereWords } from './ground.ts';
import { herdOf, speciesOf } from './wild.ts';

/** Lays `count` of `kind` at (x, y) in stacks of at most the stack size; the first on the tile,
 * the rest on free ground beside it. */
function layStacks(
  ctx: SystemContext,
  kind: string,
  count: number,
  at: [number, number],
  made: number,
): void {
  const { world, content } = ctx;
  const size = stackSize(content, kind);
  for (let left = count, k = 0; left > 0; left -= size, k += 1) {
    let [x, y] = at;
    for (let r = 1; k > 0 && r <= 4; r += 1) {
      const free = ringTiles(at, r).find(([tx, ty]) => freeTile(world, content, tx, ty));
      if (free) {
        [x, y] = free;
        break;
      }
    }
    layItem(world, { kind, count: Math.min(size, left), x, y, z: 0, made });
  }
}

const ringTiles = ([x, y]: [number, number], r: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let dy = -r; dy <= r; dy += 1)
    for (let dx = -r; dx <= r; dx += 1)
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push([x + dx, y + dy]);
  return out;
};

/**
 * `byPerson` (a person's id, 0 for none) kills `animal`, because of the line `cause` (0 for none).
 * Writes `wild.killed`, removes the animal, lays its game, leftovers and offal where it fell, adds
 * to its herd's `taken` and returns the line's id. `type` is the line's event (a predator killed
 * in a fight is `wild.predatorKilled`). `item` is laid instead of `game` (a butchered flock animal
 * lays meat). A kept animal (a flock's) writes no line: the flock's own line, `cause`, is the one
 * the goods cite, and is what is returned.
 */
export function killAnimal(
  ctx: SystemContext,
  animal: EntityRow,
  byPerson: number,
  cause: number,
  type = 'wild.killed',
  item = 'game',
): number {
  const { world, content } = ctx;
  const herd = herdOf(world, animal['herd'] as number);
  const def = herd
    ? speciesOf(content, herd['species'] as string)
    : content.wild.predators.find((p) => p.kind === animal['kind'])!;
  const [x, y] = [animal['x'] as number, animal['y'] as number];
  const person = byPerson ? world.entities['person']?.find((p) => p.id === byPerson) : undefined;
  const causes = [cause, herd?.['line'] as number | undefined].filter((c): c is number => !!c);
  const line = herd?.['kept']
    ? cause
    : ctx.emit(type, {
        actors: byPerson ? [byPerson] : [],
        causes,
        data: {
          who: (person?.['name'] as string | undefined) ?? 'Someone',
          a: 'a',
          species: def.name,
          where: whereWords(world, content, x, y),
        },
      });
  removeEntity(world, 'animal', animal.id);
  if (def.meat) layStacks(ctx, item, def.meat, [x, y], line);
  for (const l of def.leftovers) layStacks(ctx, l.item, l.count, [x, y], line);
  layStacks(ctx, 'offal', 1, [x, y], line);
  if (herd) {
    if (byPerson && !herd['kept']) herd['taken'] = (herd['taken'] as number) + 1;
    herd['line'] = line;
    checkLow(ctx, herd);
  }
  return line;
}

/**
 * A wild animal joins a kept herd (the flock's): it leaves its wild herd, which counts it as taken
 * and, with `line` (the flock's line about it), takes that as its latest; `fields` (kind, sex, young,
 * born, tamedBy) are applied and its way and fright are cleared. Returns the wild herd it left.
 */
export function tameAnimal(
  ctx: SystemContext,
  animal: EntityRow,
  keptHerd: number,
  fields: Readonly<Record<string, number | string>>,
  line = 0,
): EntityRow | undefined {
  const wild = herdOf(ctx.world, animal['herd'] as number);
  Object.assign(animal, { herd: keptHerd, path: [], state: '', until: 0 }, fields);
  if (!wild) return undefined;
  wild['taken'] = (wild['taken'] as number) + 1;
  if (line) wild['line'] = line;
  checkLow(ctx, wild);
  return wild;
}
