// The lord's man and his tithe as the page shows them (6C Slice 4, V-237): the tithe block at the
// top of Stock, the reeve on the map while he is in the valley and his page when he is tapped.
// Pure reads of the world and content; every word is made here (GAME-02). He is no colonist: he is
// in no people list, and no lever moves him (V-041).
import { content } from '../content/index.ts';
import {
  apartOf,
  clockAt,
  entityOf,
  favourAt,
  lordName,
  lordRow,
  list,
  rateIn,
  recordOf,
  reeveRow,
  titheRows,
  TICKS_PER_DAY,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import { namedLord } from './lordview.ts';
import type { LedgerLine } from './protocol.ts';
import type { ReevePage, ReeveView, TitheView } from './protocol-lord.ts';

type LineOf = (e: SimEvent | Stub) => LedgerLine;

const itemWord = (kind: string): string =>
  (content.items.find((d) => d.id === kind)?.name ?? kind).toLowerCase();

/** "40 turnips and 2 fleece" for kinds and counts, none for nothing. */
const goodsWords = (counts: Iterable<[string, number]>): string =>
  list([...counts].filter(([, n]) => n > 0).map(([k, n]) => `${n} ${itemWord(k)}`));

/** "Day 3 of Harvestmonth, Year 1" */
function dateOf(tick: number): string {
  const c = clockAt(tick, content.calendar);
  return `Day ${c.day} of ${content.calendar.monthNames[c.month]!}, Year ${c.year}`;
}

/** The Stock sheet's tithe block: his last take, what is owed from now, what lies in the barn for
 * him and what is set apart there for asks. */
export function titheView(world: WorldState): TitheView | undefined {
  const lord = namedLord(world);
  if (!lord) return undefined;
  const reeve = lord['reeve'] as string;
  const took = lord['tithed']
    ? `On ${dateOf(lord['tookAt'] as number)}, ${reeve} took ${lord['took'] as string}.`
    : `${reeve} has taken nothing yet: the first share is owed from the next harvest home.`;
  const rate = rateIn(world, content);
  const share = rate === 10 ? 'a tenth' : `${rate} in 100`;
  const owed = rate
    ? `Owed for the next harvest home: ${share} of every harvest, fleece, wool, ingot and iron thing brought in from today. Each share is carried to the tithe barn as it comes in.`
    : 'Owed for the next harvest home: nothing, for the lord grants a year free of the tithe.';
  const barn = goodsWords(titheRows(world).map((r) => [r['kind'] as string, r['barn'] as number]));
  const apart = goodsWords(apartOf(world));
  return {
    lord: lordName(lord),
    took,
    why: (lord['tithed'] as number) || 0,
    owed,
    barn: `In the barn for him now: ${barn || 'nothing'}.`,
    apart: apart
      ? `Set apart in the barn for asks: ${apart}.`
      : 'Nothing is set apart in the barn for asks.',
    note: 'Nobody eats what is in the barn, but the hungry or angry may take from it, and then it is short.',
  };
}

/** The race (an id, "orc") of the lord's people. */
const raceOf = (lord: EntityRow): string =>
  content.cultures.find((c) => c.id === lord['culture'])?.raceId ?? 'human';

/** The reeve for the map: where he stands, drawn in the people art of the lord's race. */
export function reeveView(world: WorldState): ReeveView | undefined {
  const r = reeveRow(world);
  const lord = lordRow(world);
  if (!r || !lord) return undefined;
  return { x: r['x'] as number, y: r['y'] as number, z: r['z'] as number, race: raceOf(lord) };
}

const personName = (world: WorldState, id: unknown): string =>
  (entityOf(world, 'person', id as number)?.['name'] as string | undefined) ?? 'someone';

/** What he is doing: riding in to find whom he seeks, or riding home. */
function doingNow(world: WorldState, r: EntityRow, lord: EntityRow): string {
  return r['going']
    ? `Riding back to ${lord['home'] as string} by the road he came`
    : `Riding in to find ${personName(world, r['seeks'])}, to speak for the lord`;
}

/** "This morning" on the day he came, else the date. */
const cameWords = (world: WorldState, tick: number): string =>
  Math.floor(tick / TICKS_PER_DAY) === Math.floor(world.tick / TICKS_PER_DAY)
    ? 'This morning'
    : dateOf(tick);

/** His lines this visit, newest first: from his coming, every line of the lord. */
function visitLines(world: WorldState, since: number, lineOf: LineOf): LedgerLine[] {
  return world.log
    .filter((e) => e.type.startsWith('lord.') && e.tick >= since)
    .reverse()
    .slice(0, 6)
    .map(lineOf);
}

/** The reeve's page: who he is, doing now, came, leaves, the lord's favour and his lines this
 * visit; none once he has gone. */
export function reevePage(world: WorldState, lineOf: LineOf): ReevePage | undefined {
  const r = reeveRow(world);
  const lord = lordRow(world);
  if (!r || !lord) return undefined;
  const race = content.races.find((x) => x.id === raceOf(lord))?.name.toLowerCase() ?? 'person';
  const came = recordOf(world, r['came'] as number);
  const home = lord['home'] as string;
  const leave = content.lord.reeve.leave;
  const rows: ReevePage['rows'] = [
    { name: 'Doing now', text: doingNow(world, r, lord) },
    {
      name: 'Came',
      text: `${came ? cameWords(world, came.tick) : 'Today'}, up the road from ${home}`,
      why: r['came'] as number,
    },
    { name: 'Leaves', text: `By ${String(leave).padStart(2, '0')}:00, back down the same road` },
  ];
  if (lord['named'])
    rows.push({
      name: "The lord's favour",
      text: `${favourAt(world, content)} of 100 now`,
    });
  return {
    title: 'The reeve',
    who:
      `${lord['reeve'] as string}, reeve to ${lordName(lord)}. A ${race} of the ` +
      `${lord['realm'] as string}, here on the lord's business with his cart.`,
    rows,
    lines: came ? visitLines(world, came.tick, lineOf) : [],
  };
}
