// Old age (P6.1 part 2, V-161): from family.json `old.from` per cent of their race's lifespan each
// day carries a chance of dying of old age, `old.per` in 100,000 for each year past it. Health's
// death line, grief and burial follow as for any death; the kin's own grief is health's too.
import type { SystemContext } from '../sim/index.ts';
import { die } from '../health/index.ts';
import { alive } from '../entity/index.ts';
import { ageOf } from './tables.ts';

/** Each day: the old may die of old age, citing their birth or their coming to the valley. */
export function oldAgeDay(ctx: SystemContext): void {
  const { world, content } = ctx;
  const old = content.family.old;
  const rng = ctx.rng();
  for (const p of alive(world)) {
    const race = content.races.find((r) => r.id === p['race']);
    if (!race) continue;
    const past = ageOf(world, content, p) - Math.floor((race.lifespanYears * old.from) / 100);
    if (past < 1 || rng.int(100_000) >= old.per * past) continue;
    const them = p['sex'] === 'f' ? 'her' : 'him';
    const cause = [p['bornLine'] as number, p['arrived'] as number].filter((l) => l > 0);
    die(ctx, p, old.cause.replace('{them}', them), cause);
  }
}
