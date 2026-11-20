// What a person is doing, in words: the strip's short label (P2.2) and the sentence with its why
// (P2.9, content `work.doing`). One row per job in each table, so a new craft adds its row here
// and nothing in people.ts. A pure read of the world.
import { content } from '../content/index.ts';
import {
  cropNow,
  fieldsOf,
  itemName,
  itemsOf,
  loadOf,
  nextNeed,
  partOf,
  plansOf,
  stationsOf,
  stockOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import { careNow } from './health.ts';
import { deadNow } from './healthview.ts';
import { boutOf, illDef } from './illview.ts';
import { hearthDoing, tendDoing } from './fires.ts';
import { herdDoing } from './herd.ts';
import { carpentryDoing } from './furniture.ts';
import type { WalkerView } from './protocol.ts';

/** A label, or the pair said while walking there and once there. */
type Words = string | readonly [walking: string, there: string];
const pick = (words: Words, walking: boolean): string =>
  typeof words === 'string' ? words : words[walking ? 0 : 1];

/** The strip's label for each job at work; any other job is hauling. */
const WORK_LABELS = new Map<string, Words>([
  ['carry', 'Carrying the hurt'],
  ...['bind', 'dress', 'feed', 'draught'].map((j): [string, Words] => [j, 'Tending the hurt']),
  ['bury', 'Burying the dead'],
  ['fell', ['Going to fell a tree', 'Felling']],
  ['quarry', ['Going to a boulder', 'Quarrying']],
  ['build', ['Going to build', 'Building']],
  ['carpentry', ['Going to make furniture', 'Making furniture']],
  ['thatch', ['Going to thatch', 'Thatching']],
  ['mason', ['Going to the stonework', 'Working stone']],
  ['limeburn', ['Going to burn lime', 'Burning lime']],
  ['hearth', ['Going to make a hearth', 'Making a hearth']],
  ['tend', ['Going to a fire', 'Tending a fire']],
]);
const HAULING: Words = ['Carrying to the store', 'Hauling'];

/** The strip's label for each other doing; anything else is strolling or idle. */
const DOING_LABELS = new Map<string, Words>([
  ['hurt', 'Lying hurt'],
  ['sleep', ['Going to bed', 'Sleeping']],
  ['eat', ['Going to eat', 'Eating']],
  ['relax', 'Taking it easy'],
  ['pray', ['Going to pray', 'Praying']],
  ['warm', 'Warming up'],
  ['watch', ['Going to the fold', 'Keeping watch']],
  // Defiance (P6.7): a day's sentence of the stocks, and walking out of the valley for good.
  ['stocks', ['Going to the stocks', 'In the stocks']],
  ['leave', 'Leaving the valley'],
]);
const IDLE: Words = ['Strolling', 'Idle'];

/** What a person is doing, in words (P2.2). */
export function doingOf(p: EntityRow): string {
  const walking = (p['path'] as number[]).length > 0;
  if (p['status'] === 'dead') return 'Dead';
  if (p['status'] === 'away') return 'Away';
  const words =
    p['doing'] === 'work'
      ? (WORK_LABELS.get(p['job'] as string) ?? HAULING)
      : (DOING_LABELS.get(p['doing'] as string) ?? IDLE);
  return pick(words, walking);
}

type Say = (key: string, vars?: Record<string, string>) => string;
/** A job's sentence for one worker. */
type Phrase = (world: WorldState, p: EntityRow, say: Say) => string;

/** The `work.doing` keys for the needs, walking there and once there. */
const NEED_KEYS = new Map<string, Words>([
  ['sleep', ['goSleep', 'sleep']],
  ['eat', ['goEat', 'eat']],
  ['relax', 'relax'],
  ['pray', ['goPray', 'pray']],
  ['warm', 'warm'],
  ['watch', ['goWatch', 'watch']],
  ['stocks', ['goStocks', 'stocks']],
  ['leave', 'leave'],
]);

const keyed =
  (doing: (world: WorldState, p: EntityRow) => { key: string; vars: Record<string, string> }) =>
  (world: WorldState, p: EntityRow, say: Say) => {
    const { key, vars } = doing(world, p);
    return say(key, vars);
  };
const plain =
  (key: string): Phrase =>
  (_w, _p, say) =>
    say(key);

function building(world: WorldState, p: EntityRow, say: Say): string {
  const plan = plansOf(world).find((r) => r.id === p['plan']);
  const part = plan && partOf(content, plan['part'] as string);
  const carrying = loadOf(world, p.id);
  const next = plan && nextNeed(content, plan);
  const key = plan?.['state'] === 'down' ? 'takeDown' : next && !carrying ? 'fetch' : 'build';
  const what = itemName(content, next ? next.material : (part?.material ?? ''));
  return say(key, { part: part?.name ?? '', what });
}

function station(world: WorldState, p: EntityRow, say: Say): string {
  const kind = stationsOf(world).find((s) => s.id === p['plan'])?.['kind'] as string | undefined;
  const what = kind === 'pits' ? content.clothes.pits.name : (kind ?? 'smelter');
  return say('station', { what });
}

const potting: Phrase = (_w, p, say) =>
  say(p['make'] === 'carry' ? 'potted' : 'potter', {
    what: p['make'] === 'brick' ? 'bricks' : 'a pot',
  });

function smithing(world: WorldState, p: EntityRow, say: Say): string {
  const [tool = ''] = String(p['making']).split(':');
  const who = (world.entities['person'] ?? []).find((q) => q.id === p['plan']);
  return say('smith', { tool, who: (who?.['name'] as string) ?? '' });
}

function farming(world: WorldState, p: EntityRow, say: Say): string {
  const f = fieldsOf(world).find((r) => r.id === p['plan']);
  const crop =
    f &&
    (content.buildings.field.crops.find((c) => c.id === f['crop']) ?? cropNow(world, content, f));
  const seed = loadOf(world, p.id)?.['kind'] === content.buildings.field.seed;
  const key = f?.['state'] === 'ripe' ? 'reap' : seed ? 'sow' : 'fetchSeed';
  return say(key, { crop: crop?.name ?? '' });
}

/** Sinking, tunnelling or mining for a metal's ingot plate, or digging clay for a wall. */
function mining(world: WorldState, p: EntityRow, say: Say): string {
  const task = p['task'] as string;
  const what = p['what'] as string;
  const plate = content.work.stock.find((s) => s.good === `${what}-ingot`);
  const level = plate && (stockOf(world, plate.good)?.['level'] as string | undefined);
  const vars = { metal: what, part: what, good: plate?.name ?? '', level: level ?? '' };
  return say(task === 'sink' ? 'shaft' : task, vars);
}

/** Felling, quarrying or foraging, with the plate the work fills and its level. */
function gathering(world: WorldState, p: EntityRow, say: Say): string {
  const job = p['job'] as string;
  const tile = p['target'] as number;
  const feature = job === 'forage' && tile >= 0 ? world.map.features[tile] : 0;
  const herbs = !!feature && content.features[feature - 1]?.kind === 'herb';
  const good =
    job === 'fell'
      ? content.work.stock[0]?.good
      : job === 'quarry'
        ? content.work.quarry.good
        : herbs
          ? content.work.forage.herbs.good
          : content.work.forage.good;
  const def = content.work.stock.find((s) => s.good === good);
  const level = (good && stockOf(world, good)?.['level']) as string | undefined;
  return say(herbs ? 'forageHerbs' : job, { good: def?.name ?? good ?? '', level: level ?? '' });
}

/** Each job's sentence; a job not here is hauling. */
const JOB_PHRASES = new Map<string, Phrase>([
  ['build', building],
  ['carpentry', keyed(carpentryDoing)],
  ['tend', keyed(tendDoing)],
  ['cook', plain('cook')],
  ['thatch', plain('thatch')],
  ['mason', plain('masonry')],
  ['limeburn', plain('lime burning')],
  ['charcoal', plain('charcoal')],
  ['smelt', plain('smelt')],
  ['station', station],
  ['cure', (_w, p, say) => say('cure', { what: itemName(content, p['what'] as string) })],
  ['potter', potting],
  ['cooper', (_w, p, say) => say(p['make'] === 'carry' ? 'coopered' : 'cooper')],
  ['smith', smithing],
  ['farm', farming],
  ['herd', keyed(herdDoing)],
  ['hearth', (world, p, say) => say('hearth', hearthDoing(world, p))],
  ['mine', mining],
  ['fell', gathering],
  ['forage', gathering],
  ['quarry', gathering],
]);

/** What a person is doing and why, in the words of content `work.doing` (P2.9): the sentence,
 * and the line where they took the work up when it has one. */
export function nowOf(world: WorldState, p: EntityRow): WalkerView['now'] {
  const words = content.work.doing;
  const walking = (p['path'] as number[]).length > 0;
  const say: Say = (key, vars = {}) =>
    (words[key] ?? '').replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  const gone = deadNow(world, p);
  if (gone) return gone;
  // Sent away by the Sickness law (P6.5): out of the valley until it passes.
  if (p['status'] === 'away') return awayNow(world, p, say);
  const care = careNow(world, p, say);
  if (care) return { text: care };
  const doing = p['doing'] as string;
  if (doing !== 'work')
    return { text: say(pick(NEED_KEYS.get(doing) ?? ['stroll', 'idle'], walking)) };
  const phrase = JOB_PHRASES.get(p['job'] as string);
  if (!phrase) return { text: say('haul', { what: haulWhat(world, p) }) };
  const took = p['took'] as number;
  return { text: phrase(world, p, say), ...(took !== undefined && took > 0 && { why: took }) };
}

function awayNow(world: WorldState, p: EntityRow, say: Say): WalkerView['now'] {
  const bout = boutOf(world, p.id);
  const ill = illDef(bout?.['ill'])?.name ?? 'a sickness';
  const sent = (bout?.['sent'] as number) ?? 0;
  return { text: say('away', { ill }), ...(sent > 0 && { why: sent }) };
}

/** The name of what a hauler carries or goes for, or ''. */
function haulWhat(world: WorldState, p: EntityRow): string {
  const item = loadOf(world, p.id) ?? itemsOf(world).find((i) => i.id === (p['target'] as number));
  return item ? itemName(content, item['kind'] as string) : '';
}
