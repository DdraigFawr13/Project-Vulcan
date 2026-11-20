// Growing up and taken in (P6.1 part 2, Morgan's call). Each day a child who comes of age leaves
// their parents' household and wants a home of their own (build's house wants); a child whose
// household parent died passes to the other parent, and an orphan is taken in by a wed couple
// with no child at home, those who cannot have their own first. Nobody chooses for them (V-041).
import type { EntityRow } from '../core/index.ts';
import { alive, personOf } from '../entity/index.ts';
import { bodyOf } from '../health/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { ageOf, bondsOf, grown, nameOf } from './tables.ts';

const living = (ctx: SystemContext, id: unknown) => {
  const p = personOf(ctx.world, id);
  return p?.['status'] === 'alive' ? p : undefined;
};

/** Whether a wed couple can have no child of their own: two of one sex, or she is past `until`. */
function childless(ctx: SystemContext, a: EntityRow, b: EntityRow): boolean {
  if (a['sex'] === b['sex']) return true;
  const mother = a['sex'] === 'f' ? a : b;
  const race = ctx.content.races.find((r) => r.id === mother['race']);
  const age = ageOf(ctx.world, ctx.content, mother);
  return !race || age * 100 >= race.lifespanYears * ctx.content.family.birth.until;
}

/** The wed couple who take in an orphan: both living and no child at home; those who cannot have
 * their own first, then the longest wed. */
function fosterOf(ctx: SystemContext): [EntityRow, EntityRow] | undefined {
  const home = new Set(alive(ctx.world).map((c) => c['household'] as number));
  const couples = bondsOf(ctx.world)
    .filter((r) => r['state'] === 'wed')
    .map((r) => [living(ctx, r['a']), living(ctx, r['b'])] as const)
    .filter((c): c is [EntityRow, EntityRow] => !!c[0] && !!c[1])
    .filter(([a, b]) => !home.has(a.id) && !home.has(b.id));
  return couples.find(([a, b]) => childless(ctx, a, b)) ?? couples[0];
}

/** An orphan or a left child is taken in, citing their parents' deaths or the line they were
 * left on (`family.takenIn`); none while no couple can. */
function takeIn(ctx: SystemContext, p: EntityRow): void {
  const foster = fosterOf(ctx);
  if (!foster) return;
  const [a, b] = foster;
  const w = ctx.content.family.words;
  const deaths = [p['mother'], p['father']]
    .map((id) => bodyOf(ctx.world, id as number)?.['died'] as number | undefined)
    .filter((l): l is number => !!l);
  const line = ctx.emit('family.takenIn', {
    causes: deaths.length ? deaths : [(p['left'] || p['bornLine']) as number],
    actors: [p.id, a.id, b.id],
    data: { name: nameOf(p), a: nameOf(a), b: nameOf(b), why: p['left'] ? w.leftHere : w.orphan },
  });
  Object.assign(p, { household: a.id, fostered: line });
  addMemory(ctx, p.id, ctx.content.family.memories.taken, line, a.id);
}

/** Each day: those grown come of age; a child whose household parent died passes to the other
 * parent, else to a foster couple. */
export function growingDay(ctx: SystemContext): void {
  const { world, content } = ctx;
  for (const p of alive(world)) {
    if (!p['mother'] && !p['father'] && !p['left']) continue;
    const head = p['household'] as number;
    if (grown(world, content, p)) {
      if (!head) continue;
      const line = ctx.emit('family.cameOfAge', {
        causes: [p['bornLine'] as number].filter((l) => l > 0),
        actors: [p.id],
        data: { name: nameOf(p), age: ageOf(world, content, p) },
      });
      Object.assign(p, { household: 0, wantsFrom: world.tick, wants: line });
      addMemory(ctx, p.id, content.family.memories.grown, line);
      continue;
    }
    if (head && living(ctx, head)) continue;
    const parent = [p['mother'], p['father']].map((id) => living(ctx, id)).find(Boolean);
    if (parent) p['household'] = parent.id;
    else takeIn(ctx, p);
  }
}
