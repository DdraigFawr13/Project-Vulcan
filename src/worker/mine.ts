// Shafts as the page shows them (Bundle 2): the faint plans on the map, a plan's tile page, the
// signal that the Mining row may show and the ore asides on the Stock sheet. Every value is the
// engine's answer put into words (GAME-02); nothing here picks a tile or a person (V-041). Pure
// reads of the world, like fields.ts.
import { content } from '../content/index.ts';
import {
  haveOf,
  recordOf,
  shaftsOf,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { LedgerLine, TileView } from './protocol.ts';
import type { GoodsView } from './protocol-goods.ts';

const mine = content.work.mine;
const itemName = (id: string): string => content.items.find((i) => i.id === id)?.name ?? id;

/** Shafts planned or being sunk, for the map's faint plan layer. */
export const shaftPlans = (world: WorldState): GoodsView['shafts'] =>
  shaftsOf(world)
    .filter((s) => s['state'] === 'planned' || s['state'] === 'sinking')
    .map((s) => ({
      x: s['x'] as number,
      y: s['y'] as number,
      z: 0,
      state: s['state'] as string,
    }));

/** Any shaft has been planned and not sent back (or is done): the Mining row may show. */
export const miningShown = (world: WorldState): boolean =>
  shaftsOf(world).some((s) => s['state'] !== 'sent');

/** Minutes as hours in words: "4", or "1.5". */
const hours = (minutes: number): string => String(Math.round(minutes / 6) / 10);

/** The shaft plan on surface tile (x, y), for its page. */
export function tileShaft(
  world: WorldState,
  x: number,
  y: number,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): Pick<TileView, 'shaft'> {
  const s = shaftsOf(world).find(
    (r) => r['x'] === x && r['y'] === y && (r['state'] === 'planned' || r['state'] === 'sinking'),
  );
  if (!s) return {};
  const to = s['to'] as number;
  const ladder = Object.entries(mine.ladder)
    .map(([kind, n]) => `${n} ${itemName(kind)}`)
    .join(' and ');
  const who = (world.entities['person'] ?? []).find(
    (p) => p['job'] === mine.job && p['task'] === 'sink' && p['plan'] === s.id,
  );
  const placed = recordOf(world, s['line'] as number);
  const jobName = content.jobs.find((j) => j.id === mine.job)?.name ?? 'mining';
  return {
    shaft: {
      id: s.id,
      state: s['state'] as string,
      what: `a shaft${ladder ? ' with a ladder' : ''}, down to level ${to}`,
      why: s['why'] as string,
      work:
        `about ${hours(mine.shaft)} hours a level, ${hours(mine.shaft * to)} in all, by whoever ` +
        `takes up ${jobName}${ladder ? `; ${ladder} for the ladder` : ''}`,
      ...(who && {
        here: `${who['name'] as string}, ${s['depth'] ? 'sinking' : 'starting'} the shaft`,
      }),
      back: s['state'] === 'planned' && !s['depth'] && !s['sentBack'] && !who,
      ...(placed && { placed: lineOf(placed) }),
    },
  };
}

/** An ingot plate's aside: `{ore}` in its note is the ore held, from the engine. */
export const stockNote = (world: WorldState, good: string, note: string): string =>
  note.replace('{ore}', String(haveOf(world, content, good.replace(/-ingot$/, '-ore'))));
