// The tavern's name and its keeper (6B Bundle 5, P6.12, V-188). Once the tavern house is built it
// is named from `tavern.build.names` (one not yet used here). The innkeeper is the living grown-up
// who puts Inn-keeping highest on their Work sheet; ties go to the `keeper.trait` (sociable),
// then the lowest id. Nobody is appointed: the Work sheet is the only lever (V-041).
import type { EntityRow } from '../core/index.ts';
import { levelOf } from '../band/index.ts';
import { tavernHouse } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { grown } from '../family/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { tavernOf } from './tables.ts';

/** A built tavern with no row yet gets its name. */
export function nameTavern(ctx: SystemContext): void {
  const { world, content } = ctx;
  const h = tavernHouse(world);
  if (!h || h['state'] !== 'built' || tavernOf(world)) return;
  const used = new Set((world.entities['tavern'] ?? []).map((t) => t['name']));
  const names = content.tavern.build.names.filter((n) => !used.has(n));
  const name = names.length ? ctx.rng().pick(names) : content.tavern.build.names[0]!;
  const line = ctx.emit('tavern.named', { causes: [h['built'] as number], data: { name } });
  addEntity(world, 'tavern', { house: h.id, name, line, keeper: 0, kept: 0, noGrain: 0 });
}

const hasTrait = (ctx: SystemContext, p: EntityRow, trait: string): boolean =>
  (ctx.world.entities['trait'] ?? []).some((t) => t['person'] === p.id && t['trait'] === trait);

/** The living grown-up who puts `job` highest on their Work sheet; ties go to `trait`, then
 * the lowest id (the innkeeper, the bard). */
export function highestOn(ctx: SystemContext, job: string, trait: string): EntityRow | undefined {
  const { world, content } = ctx;
  const rank = (p: EntityRow) => levelOf(world, content, p.id, job) * 2 - +hasTrait(ctx, p, trait);
  return (world.entities['person'] ?? [])
    .filter((p) => p['status'] === 'alive' && !p['stranger'] && grown(world, content, p))
    .sort((a, b) => rank(a) - rank(b) || a.id - b.id)[0];
}

/** Each hour: the innkeeper is whoever puts Inn-keeping highest; a change is a line. */
export function chooseKeeper(ctx: SystemContext): void {
  const { world, content } = ctx;
  const t = tavernOf(world);
  if (!t) return;
  const { job, trait } = content.tavern.keeper;
  const best = highestOn(ctx, job, trait);
  const id = best?.id ?? 0;
  if (id === t['keeper']) return;
  t['keeper'] = id;
  if (!best) return;
  const first = levelOf(world, content, best.id, job) < content.work.priority.start;
  const prio = (world.entities['priority'] ?? []).find(
    (r) => r['person'] === best.id && r['job'] === job,
  );
  t['kept'] = ctx.emit('tavern.keeper', {
    causes: [t['line'] as number, ...(prio ? [prio['line'] as number] : [])],
    actors: [best.id],
    data: {
      name: best['name'] as string,
      tavern: t['name'] as string,
      why: first ? ', who puts inn-keeping high on their list' : '',
    },
  });
}
