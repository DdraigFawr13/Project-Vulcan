// Births and children (P6.1 part 2, V-145, V-161). Each day at family.json `hour`: a wed woman and
// man may find her with child (`birth`), never in lean times; after `carryDays` the child is born
// in the valley, sleeping in their parents' home until they come of age; then they want a home of
// their own (kin.ts).
import { TICKS_PER_DAY, yearNow, type EntityRow, type RngStream } from '../core/index.ts';
import { addPerson, drawChild, type Inherited } from '../band/index.ts';
import { alive, personOf, people } from '../entity/index.ts';
import { foodDays, layItem } from '../goods/index.ts';
import { addMemories, seedPerson } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { ageOf, bondsOf, grown, nameOf } from './tables.ts';

const SMITHING_NONE = { level: 0, potential: 0 };

/** The wife and husband of a wed bond, both living; none for two of one sex. */
function parentsOf(ctx: SystemContext, r: EntityRow): [EntityRow, EntityRow] | undefined {
  const a = personOf(ctx.world, r['a']);
  const b = personOf(ctx.world, r['b']);
  if (!a || !b || a['status'] !== 'alive' || b['status'] !== 'alive' || a['sex'] === b['sex'])
    return undefined;
  return a['sex'] === 'f' ? [a, b] : [b, a];
}

/** Whether she may conceive today: of age, under `until` per cent of her lifespan, rested since
 * her last child, and neither the store nor she hungry. */
function mayConceive(ctx: SystemContext, r: EntityRow, mother: EntityRow): boolean {
  const { world, content } = ctx;
  const b = content.family.birth;
  const race = content.races.find((x) => x.id === mother['race']);
  if (!race || !grown(world, content, mother)) return false;
  if (ageOf(world, content, mother) * 100 >= race.lifespanYears * b.until) return false;
  if (r['last'] && world.tick - (r['last'] as number) < b.restDays * TICKS_PER_DAY) return false;
  if (foodDays(world, content, alive(world).length).days < b.leanDays) return false;
  const now = world.tick;
  return !(world.entities['memory'] ?? []).some(
    (m) => m['person'] === mother.id && m['memory'] === b.hungry && (m['until'] as number) > now,
  );
}

/** The chance today, in a million: `perMille` times her race's fertility. */
function oddsOf(ctx: SystemContext, mother: EntityRow): number {
  const race = ctx.content.races.find((x) => x.id === mother['race']);
  return Math.floor(ctx.content.family.birth.perMille * 1000 * (race?.fertility ?? 1));
}

/** "; quick-handed like her mother" for each gift and weakness taken. */
function takenWords(ctx: SystemContext, sex: string, taken: readonly Inherited[]): string {
  const w = ctx.content.family.words;
  const their = sex === 'f' ? 'her' : 'his';
  return taken
    .map(
      (t) =>
        `; ${w.like.replace('{word}', t.word).replace('{their}', their).replace('{parent}', w[t.from])}`,
    )
    .join('');
}

/** A child is born: their rows, the Born line, a bedroll at their mother's feet, the parents'
 * memory. */
function deliver(
  ctx: SystemContext,
  rng: RngStream,
  r: EntityRow,
  [mother, father]: [EntityRow, EntityRow],
): void {
  const { world, content } = ctx;
  const taken = people(world).map(nameOf);
  const { person, inherited } = drawChild(rng, content, [mother, father], taken);
  const at = { x: mother['x'] as number, y: mother['y'] as number };
  const id = addPerson(
    world,
    content,
    person,
    { ...at, status: 'alive', arrived: 0, born: yearNow(world, content), rest: 0 },
    SMITHING_NONE,
    { mother: mother.id, father: father.id, household: mother.id },
  );
  const w = content.family.words;
  const race = content.races.find((x) => x.id === person.race)?.name.toLowerCase() ?? person.race;
  const line = ctx.emit('family.born', {
    causes: [r['expect'] as number],
    actors: [id, mother.id, father.id],
    data: {
      name: person.name,
      mother: nameOf(mother),
      father: nameOf(father),
      race,
      child: person.sex === 'f' ? w.girl : w.boy,
      taken: takenWords(ctx, person.sex, inherited),
    },
  });
  const child = personOf(world, id)!;
  Object.assign(child, { arrived: line, bornLine: line });
  seedPerson(world, content, child);
  layItem(
    world,
    { kind: content.life.cart.bedroll, count: 1, ...at, z: 0, made: line },
    { owner: id, state: 'laid' },
  );
  addMemories(ctx, [mother.id, father.id], content.family.memories.born, line, id);
  Object.assign(r, { due: 0, expect: 0, last: world.tick });
}

/** Each day: births due, and wed women found with child. */
export function birthsDay(ctx: SystemContext): void {
  const { world, content } = ctx;
  const rng = ctx.rng();
  for (const r of bondsOf(world).filter((x) => x['state'] === 'wed')) {
    const parents = parentsOf(ctx, r);
    if (!parents) continue;
    const [mother, father] = parents;
    if (r['due']) {
      if (world.tick >= (r['due'] as number)) deliver(ctx, rng, r, parents);
      continue;
    }
    if (!mayConceive(ctx, r, mother) || rng.int(1_000_000) >= oddsOf(ctx, mother)) continue;
    const line = ctx.emit('family.expecting', {
      causes: [r['line'] as number],
      actors: [mother.id, father.id],
      data: { mother: nameOf(mother), father: nameOf(father) },
    });
    Object.assign(r, {
      due: world.tick + content.family.birth.carryDays * TICKS_PER_DAY,
      expect: line,
    });
  }
}
