// Seeing it happen (P6.3, V-155): each new ledger line of a type a tale copies (tales.json
// `event`, with its `only` data) becomes a story. Its living actors and anyone awake on the same
// level within `see` tiles of one hold it at its `truth` level, citing the line. Of a `word` tale
// (no one to see it) one awake person, by the tales' dice, brings word. Seeing it feeds the
// tale's belief.
import { TICKS_PER_DAY, type EntityRow, type SimEvent, type TaleDef } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { feedBelief } from './belief.ts';

const alive = (p: EntityRow): boolean => p['status'] === 'alive';

/** The ledger lines after `seen`, oldest first. */
function linesAfter(log: readonly SimEvent[], seen: number): SimEvent[] {
  let k = log.length;
  while (k > 0 && log[k - 1]!.id > seen) k -= 1;
  return log.slice(k);
}

/** Who saw line `e`: its living actors and the awake within sight of one, or for word of it one
 * awake person. */
function witnesses(ctx: SystemContext, def: TaleDef, e: SimEvent): EntityRow[] {
  const people = (ctx.world.entities['person'] ?? []).filter(alive);
  if (def.word) {
    const awake = people.filter((p) => p['doing'] !== 'sleep');
    return awake.length ? [ctx.rng().pick(awake)] : people.slice(0, 1);
  }
  const actors = people.filter((p) => e.actors.includes(p.id));
  const see = ctx.content.tales.see;
  const near = (p: EntityRow, a: EntityRow) =>
    p['z'] === a['z'] &&
    Math.max(
      Math.abs((p['x'] as number) - (a['x'] as number)),
      Math.abs((p['y'] as number) - (a['y'] as number)),
    ) <= see;
  return people.filter(
    (p) => actors.includes(p) || (p['doing'] !== 'sleep' && actors.some((a) => near(p, a))),
  );
}

const fits = (def: TaleDef, e: SimEvent): boolean =>
  e.type === def.event &&
  Object.entries(def.only ?? {}).every(([k, v]) => String(e.data[k] ?? '') === v);

/** Turns the lines since the last look into stories and gives them to those who saw. */
export function learn(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const fresh = linesAfter(world.log, state['seen'] ?? 0);
  if (!fresh.length) return;
  state['seen'] = fresh.at(-1)!.id;
  const day = Math.floor(world.tick / TICKS_PER_DAY);
  for (const e of fresh) {
    const def = content.tales.tales.find((t) => fits(t, e));
    if (!def) continue;
    const saw = witnesses(ctx, def, e);
    if (!saw.length) continue;
    const words = JSON.stringify(e.data);
    const story = addEntity(world, 'story', { tale: def.id, event: e.id, words });
    for (const p of saw) {
      addEntity(world, 'tale', {
        person: p.id,
        story,
        level: def.truth,
        teller: 0,
        line: e.id,
        heard: day,
        day,
      });
      feedBelief(ctx, p.id, def, def.truth, true, e.id);
    }
  }
}
