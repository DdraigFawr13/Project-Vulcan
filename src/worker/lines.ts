// Ledger lines as the page shows them: text, clock, why, and where a notable line's person
// stands as it is sent. A pure read of the world.
import {
  bynameOf,
  entityOf,
  renderEvent,
  type SimEvent,
  type Sim,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { LedgerLine } from './protocol.ts';
import { clockView, placeWords } from './views.ts';

/** Where the person a notable line is about stands as it is sent, in words from the camp; for a
 * shaft plan, where the shaft is to be. */
function whereOf(world: WorldState | undefined, e: SimEvent): Pick<LedgerLine, 'where'> {
  const p = world && e.actors[0] !== undefined ? entityOf(world, 'person', e.actors[0]) : undefined;
  const shaft = e.type === 'mine.shaftPlanned';
  if (!world || !(p || shaft)) return {};
  const [x, y, z] = p
    ? [p['x'] as number, p['y'] as number, p['z'] as number]
    : [e.data['x'] as number, e.data['y'] as number, 0];
  return { where: { x, y, z, words: placeWords(world.map, x, y, z) } };
}

/** A line's text with each actor's byname after their name, from the line that named them on
 * (6B Bundle 5): "Bran “Wolfbait” went to the tavern". */
function withBynames(world: WorldState | undefined, e: SimEvent, text: string): string {
  if (!world) return text;
  let out = text;
  for (const id of e.actors) {
    const b = bynameOf(world, id);
    const name = b && (entityOf(world, 'person', id)?.['name'] as string | undefined);
    if (!b || !name || (b['line'] as number) >= e.id) continue;
    out = out.replace(name, `${name} “${b['word'] as string}”`);
  }
  return out;
}

/** Line `e` for the page; a sealed day's stub says only when it was. */
export function lineOf(
  world: WorldState | undefined,
  sim: Pick<Sim, 'templates' | 'notable'>,
  e: SimEvent | Stub,
): LedgerLine {
  const clock = clockView(e.tick);
  if (!('causes' in e))
    return {
      id: e.id,
      tick: e.tick,
      type: e.type,
      text: `An older record, from Day ${clock.day} of ${clock.monthName}, year ${clock.year}.`,
      causes: [],
      why: false,
      clock,
      older: true,
    };
  return {
    id: e.id,
    tick: e.tick,
    type: e.type,
    text: withBynames(world, e, renderEvent(e, sim.templates)),
    causes: [...e.causes],
    why: e.causes.some((c) => c !== world?.begunEvent),
    clock,
    ...(e.actors.length > 0 && { actors: [...e.actors] }),
    ...(sim.notable(e) && { notable: true as const, ...whereOf(world, e) }),
  };
}
