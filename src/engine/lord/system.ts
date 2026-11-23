// The lord system (6C Slice 1, V-210, V-216): the morning after each harvest home the lord's reeve
// comes; the first time, the lord is copied from the Story Generator world into the save. A plain
// seed (no region) has no lord.
import { TICKS_PER_DAY, TICKS_PER_HOUR, today } from '../core/index.ts';
import type { EngineContent, EntityRow } from '../core/index.ts';
import { addEntity, people } from '../entity/index.ts';
import { edgeSpot, nameFrom } from '../band/index.ts';
import { lordOf, namesOf, type Lord } from '../region/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { reeveMinute, sendReeve, soughtOf } from './reeve.ts';
import { LORD_TABLES, lordRow, reeveRow, titleOf } from './tables.ts';
import { setDue } from './tithe.ts';

/** The first harvest-home supper called after feast `done` (a supper with no couple and no feast
 * day), eaten or not (V-220): the reeve comes for the harvest, not the supper. */
function nextHarvest(ctx: SystemContext): EntityRow | undefined {
  return (ctx.world.entities['feast'] ?? []).find(
    (f) => f.id > (ctx.state['done'] ?? 0) && !(f['couple'] as number[]).length && !f['holy'],
  );
}

/** A name for the reeve from the lord's people, drawn again (up to 20 times) while one of the
 * colony or the lord bears it. */
function reeveName(
  ctx: SystemContext,
  names: EngineContent['cultures'][number]['names'],
  lord: string,
): string {
  const taken = new Set([lord, ...people(ctx.world).map((p) => p['name'] as string)]);
  const sex = ctx.content.lord.reeve.sex;
  let name = nameFrom(ctx.rng(), names, sex);
  for (let k = 0; k < 20 && taken.has(name); k += 1) name = nameFrom(ctx.rng(), names, sex);
  return name;
}

/** Copies the lord into the save, with the name of the reeve who speaks for them. */
function copyLord(ctx: SystemContext, lord: Lord): void {
  const { content } = ctx;
  const names = namesOf(content, lord.culture) ?? content.cultures[0]!.names;
  addEntity(ctx.world, 'lord', {
    ...{ ruler: lord.id, name: lord.name, sex: lord.sex, born: lord.born, age: lord.age },
    ...{ child: lord.child ? 1 : 0, temper: lord.temper, word: lord.temperWord },
    ...{ line: lord.temperLine, byname: lord.byname, realm: lord.realm, kind: lord.kind },
    ...{ title: titleOf(content, lord.kind, lord.sex), home: lord.home, culture: lord.culture },
    ...{ dir: lord.dir, reeve: reeveName(ctx, names, lord.name), named: 0 },
  });
}

/** The reeve sets out the morning after a harvest home's supper day, once the hour comes. A morning missed (a
 * reeve still in the valley, a save loaded later) or a valley with no way in from the lord's side
 * loses that visit; the lord is copied only when the reeve can come. */
function maybeSend(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const f = nextHarvest(ctx);
  const due = f ? (f['on'] as number) + 1 : 0;
  if (!f || today(world) < due) return;
  const hour = Math.floor((world.tick % TICKS_PER_DAY) / TICKS_PER_HOUR);
  const { arrive, speakBy } = content.lord.reeve;
  if (today(world) === due && (hour < arrive || hour >= speakBy)) return;
  state['done'] = f.id;
  if (today(world) > due) return;
  const known = lordRow(world);
  const lord = known ? undefined : lordOf(world.seed, content);
  if (!known && !lord) {
    state['none'] = 1;
    return;
  }
  const dir = known ? (known['dir'] as string) : lord!.dir;
  if (!edgeSpot(world, content, dir) || !soughtOf(world)) return;
  if (lord) copyLord(ctx, lord);
  sendReeve(
    ctx,
    [f['line'] as number, f['eaten'] as number].filter((n) => n > 0),
  );
}

export const lordSystem: System = {
  id: 'lord',
  every: 'minute',
  stream: 'lord',
  emits: [
    ...['lord.reeveCame', 'lord.named', 'lord.counted', 'lord.reeveLeft', 'lord.tithed'],
    ...['lord.barned', 'lord.carried', 'lord.searched', 'lord.found'],
  ],
  initialState: { done: 0, none: 0 },
  tables: LORD_TABLES,
  run(ctx) {
    if (ctx.world.tick % TICKS_PER_HOUR === 0) setDue(ctx);
    const r = reeveRow(ctx.world);
    if (r) reeveMinute(ctx, r);
    else if (!ctx.state['none']) maybeSend(ctx);
  },
};
