// The Health tab's Illness box (P5.7): the bout showing now, its course in days, how it was
// caught, the last draught and whether it is catching; and the last illness they are over and
// safe from. Every sentence is a content `health.words` template filled from the engine's `ill`
// rows (GAME-02). A bout not yet showing is not shown: nobody knows of it.
import { content } from '../content/index.ts';
import {
  bodyOf,
  pronouns,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { IllnessView } from './protocol-people.ts';

type Say = (key: string, vars?: Record<string, string>) => string;
type Stamp = (world: WorldState, tick: number) => string;

/** Their bout coming or showing, and an illness's content entry (the engine's rows, read). */
export const boutOf = (world: WorldState, person: number): EntityRow | undefined =>
  (world.entities['ill'] ?? []).find(
    (r) => r['person'] === person && (r['state'] === 'coming' || r['state'] === 'sick'),
  );
export const illDef = (id: unknown) => content.health.ills.find((d) => d.id === id);

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const nameOf = (world: WorldState, id: unknown): string =>
  ((world.entities['person'] ?? []).find((q) => q.id === id)?.['name'] as string) ?? '';

/** Their bout if it is showing, with its content entry. */
function showing(world: WorldState, p: EntityRow) {
  const r = boutOf(world, p.id);
  const def = r && r['state'] === 'sick' ? illDef(r['ill']) : undefined;
  return r && def ? { r, def } : undefined;
}

/** The state sentence of someone showing an illness, or ''. */
export function sickState(world: WorldState, p: EntityRow, say: Say): string {
  const s = showing(world, p);
  if (!s) return '';
  const a = s.def.a;
  const body = bodyOf(world, p.id);
  const where = !s.def.abed
    ? say('sickUp', { a })
    : body?.['bed']
      ? say('sickBed', { a })
      : say('sickNoBed', { a });
  return `${say('sick')} ${where}`;
}

/** The Illness box for `p`, or undefined while no illness shows. */
export function illnessOf(
  world: WorldState,
  p: EntityRow,
  say: Say,
  stamp: Stamp,
): IllnessView | undefined {
  const s = showing(world, p);
  if (!s) return undefined;
  const { r, def } = s;
  const from = Math.min(world.tick, r['shows'] as number);
  const of = Math.max(1, Math.round(((r['ends'] as number) - from) / TICKS_PER_DAY));
  const day = Math.min(of, Math.floor((world.tick - from) / TICKS_PER_DAY) + 1);
  const grave = !!r['grave'];
  const state =
    (def.abed ? say('illAbed') : say('illUp')) +
    (grave ? say('illGrave', { grave: def.graveName ?? def.name }) : say('illMild'));
  const given = r['draught'] as number;
  const next = given + content.health.sick.draughtEvery * TICKS_PER_HOUR;
  const draught = !def.abed
    ? undefined
    : given
      ? say('illDraught', { healer: nameOf(world, r['healer']), time: stamp(world, given) }) +
        ((r['herbless'] as number) > given
          ? say('illNoHerbs')
          : say('illNext', { next: stamp(world, next) }))
      : say('illNoDraught');
  return {
    title: cap(def.name),
    day,
    of,
    grave,
    dayWord: say('illDay', { n: String(day) }),
    ofWord: say('illOf', { n: String(of) }),
    state,
    cause: say('illCaught', { time: stamp(world, r['caught'] as number), how: r['how'] as string }),
    ...(draught && { draught }),
    ...(def.spread > 0 && { catching: say('illCatching') }),
    why: (r['line'] as number) || (r['cause'] as number),
  };
}

/** "Had the flux, over at 10:20, 3 Leaffall; it will not take him again before 1 Frostmonth." for
 * the last illness they are over and still safe from, or undefined. */
export function pastIll(
  world: WorldState,
  p: EntityRow,
  say: Say,
  stamp: Stamp,
): string | undefined {
  const over = (world.entities['ill'] ?? [])
    .filter((r) => r['person'] === p.id && r['state'] === 'over')
    .sort((a, b) => (b['ends'] as number) - (a['ends'] as number))[0];
  const def = over && illDef(over['ill']);
  if (!over || !def || def.immune === 0) return undefined;
  const safe = (over['ends'] as number) + def.immune * TICKS_PER_DAY;
  if (def.immune > 0 && world.tick >= safe) return undefined;
  const until =
    def.immune < 0 ? '' : say('illUntil', { day: stamp(world, safe).replace(/^\d\d:\d\d, /, '') });
  return say('illPast', {
    a: def.a,
    time: stamp(world, over['ends'] as number),
    them: pronouns(p).them,
    until,
  });
}
