// Fields as the page shows them (P4.7): the Build sheet's rows and need, a field tile's page and
// the furrow frames for the map. Every value is the engine's answer put into words (GAME-02);
// nothing here picks a tile or a person (V-049). Pure reads of the world, like build.ts.
import { content } from '../content/index.ts';
import {
  buildWantOf,
  cropNow,
  cropOf,
  dirFrom,
  fieldDone,
  fieldsOf,
  fieldTiles,
  greenOf,
  haveOf,
  recordOf,
  ringOf,
  TICKS_PER_DAY,
  wantOf,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { GoodsView, LedgerLine, TileView } from './protocol.ts';
import type { BuildView, FieldRow } from './protocol-build.ts';
import { fieldCare } from './fieldcare.ts';

const def = content.buildings.field;
/** Fields that stand or are planned (not sent back). */
const liveFields = (world: WorldState): EntityRow[] =>
  fieldsOf(world).filter((f) => f['state'] !== 'sent');
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const itemName = (id: string): string => content.items.find((i) => i.id === id)?.name ?? id;

/** The crop on field `f`, or the one that would be sown on it this month. */
const cropOfField = (world: WorldState, f: EntityRow) =>
  (f['crop'] ? cropOf(content, f['crop'] as string) : undefined) ?? cropNow(world, content, f);

/** "Barley field", or "Field" while no crop can be sown. */
const nameOf = (world: WorldState, f: EntityRow): string => {
  const crop = cropOfField(world, f);
  return crop ? `${cap(crop.name)} field` : 'Field';
};

function wordsOf(f: EntityRow): string {
  const state = f['state'] as string;
  const done = fieldDone(f).length;
  if (state === 'plan')
    return done ? `sowing, ${done} of ${fieldTiles(f).length} tiles sown` : 'planned';
  if (state === 'sown') return 'sown, growing';
  return state === 'ripe' ? 'ripe' : 'fallow';
}

/** Where the field lies from the green, in a compass word. */
function dirOf(world: WorldState, f: EntityRow): string {
  const w = world.map.width;
  const tiles = fieldTiles(f);
  const xs = tiles.map((i) => i % w);
  const ys = tiles.map((i) => Math.floor(i / w));
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return dirFrom(greenOf(world), { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 });
}

/** The need in tiles of crops, and what is laid out against it. */
function needOf(world: WorldState): string {
  const alive = (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive').length;
  const live = liveFields(world);
  const count = (list: EntityRow[]) => list.reduce((n, f) => n + fieldTiles(f).length, 0);
  const planned = count(live.filter((f) => f['state'] === 'plan'));
  const have = count(live.filter((f) => !f['leave']));
  const ring = plural(ringOf(world, content), 'tile');
  return (
    `food for ${plural(alive, 'person', 'people')} through winter, about ` +
    `${plural(alive * def.perMouth, 'tile')} of crops; ${have - planned} laid out` +
    `${planned ? `, ${planned} planned` : ''}. The town ring, ${ring} round the green, is kept for homes`
  );
}

/** The Fields part of the Build sheet. */
export function buildFields(
  world: WorldState,
): Pick<BuildView, 'fieldWant' | 'fieldNeed' | 'noField' | 'fields'> {
  const level = buildWantOf(world, content, 'field').level;
  return {
    fieldWant: { level, word: content.work.priority.words[level - 1] ?? '' },
    fieldNeed: needOf(world),
    noField: !!world.systems['build']?.['fieldNoGround'],
    fields: liveFields(world).map((f): FieldRow => ({
      id: f.id,
      name: nameOf(world, f),
      tiles: fieldTiles(f).length,
      state: f['state'] as string,
      words: wordsOf(f),
      dir: dirOf(world, f),
      back: f['state'] === 'plan' && !f['sent'] && fieldDone(f).length === 0,
      sent: !!f['sent'],
      why: f['why'] as string,
    })),
  };
}

/** The furrow frames for the map: planned and fallow ground, sown tiles, ripe crops by kind, blight. Tiles
 * sown on a planned or fallow field show sown; tiles reaped on a ripe one show fallow. */
export function fieldFrames(world: WorldState): GoodsView['fields'] {
  const groups = new Map<string, number[]>();
  for (const f of liveFields(world)) {
    const state = f['state'] as string;
    const done = new Set(fieldDone(f));
    const sick = new Set((f['blight'] as number[] | undefined) ?? []);
    for (const i of fieldTiles(f)) {
      // Blighted tiles brown on a sown or ripe field until they are reaped (5B Bundle 2).
      const frame =
        sick.has(i) && (state === 'sown' || (state === 'ripe' && !done.has(i)))
          ? 'field.blight'
          : state === 'sown' || (state !== 'ripe' && done.has(i))
            ? 'field.sown'
            : state === 'ripe'
              ? done.has(i)
                ? 'field.fallow'
                : `field.ripe.${f['crop'] as string}`
              : `field.${state}`;
      groups.set(frame, [...(groups.get(frame) ?? []), i]);
    }
  }
  return [...groups].map(([frame, tiles]) => ({ frame, tiles }));
}

/** What a farmer at a field is doing there: watering and mucking are its tasks (5B Bundle 2). */
const doingOf = (p: EntityRow, state: string): string =>
  p['task'] === 'water'
    ? 'watering'
    : p['task'] === 'muck'
      ? 'carrying muck'
      : state === 'ripe'
        ? 'reaping'
        : 'sowing';

/** The field a surface tile belongs to, for its page. */
export function tileField(
  world: WorldState,
  x: number,
  y: number,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): Pick<TileView, 'field'> {
  const i = y * world.map.width + x;
  const f = fieldsOf(world).find((r) => r['state'] !== 'sent' && fieldTiles(r).includes(i));
  if (!f) return {};
  const line = (id: unknown): LedgerLine | undefined => {
    const e = typeof id === 'number' && id > 0 ? recordOf(world, id) : undefined;
    return e && lineOf(e);
  };
  const state = f['state'] as string;
  const crop = cropOfField(world, f);
  const n = fieldTiles(f).length;
  const done = fieldDone(f).length;
  const item = crop ? itemName(crop.item) : '';
  const total = crop ? crop.yield * n : 0;
  const days = (from: number, c: { days: number }) =>
    Math.max(1, Math.ceil((from + c.days * TICKS_PER_DAY - world.tick) / TICKS_PER_DAY));
  const harvest: Record<string, string> = {
    plan: done
      ? `${done} of ${n} tiles sown`
      : crop
        ? `not sown yet: ${crop.name} is sown now, ${plural(crop.days, 'day')} to ripen`
        : 'not sown yet: no crop is sown this month',
    sown: crop
      ? `ripe in ${plural(days(f['sown'] as number, crop), 'day')}, about ${total} ${item} in all`
      : '',
    ripe: `${done} of ${n} tiles reaped, about ${total} ${item} in all`,
    fallow: done ? `${done} of ${n} tiles sown` : 'reaped; waits for the next sowing month',
  };
  const seed =
    state === 'ripe'
      ? `${f['kept'] as number} go back on the Seed plate for sowing`
      : `the Seed plate holds ${haveOf(world, content, def.seed)} of ${wantOf(world, content, def.seed)} wanted`;
  const frost: Record<string, string> = {
    plan: crop ? `a frost under ${crop.frost} °C would kill it once sown` : 'nothing sown',
    sown: crop ? `a frost under ${crop.frost} °C kills it before it is ripe` : '',
    ripe: 'none matters now: it is ripe',
    fallow: 'nothing sown',
  };
  const who = (world.entities['person'] ?? []).find(
    (p) => p['job'] === content.work.farm.job && p['plan'] === f.id,
  );
  const [last, took, sited] = [line(f['last']), line(f['took']), line(f['line'])];
  const seen = new Set<number>();
  const fresh = (l?: LedgerLine): LedgerLine | undefined =>
    l && !seen.has(l.id) ? (seen.add(l.id), l) : undefined;
  const lines = { last: fresh(last), took: fresh(took), sited: fresh(sited) };
  return {
    field: {
      id: f.id,
      name: nameOf(world, f),
      crop: `${crop?.name ?? 'none yet'}, ${wordsOf(f)}`,
      size: `${plural(n, 'tile')}, ${dirOf(world, f)} of the green`,
      harvest: harvest[state] ?? '',
      seed,
      frost: frost[state] ?? '',
      ...fieldCare(world, f),
      ...(who && { here: `${who['name'] as string}, ${doingOf(who, state)}` }),
      why: f['why'] as string,
      ...(lines.last && { last: lines.last }),
      ...(lines.took && { took: lines.took }),
      ...(lines.sited && { sited: lines.sited }),
    },
  };
}
