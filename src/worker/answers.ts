// The page's questions that only read the world, between ticks: save, export, inspect, item,
// animal, why and trips. Each is one row here; none steps the world, writes a line or draws from an RNG
// stream. With no world (stopped) the worker leaves them unanswered.
import { contentHash } from '../content/index.ts';
import { toNdjson, whyOf, type SimEvent, type Stub, type WorldState } from '../engine/index.ts';
import { itemView } from './items.ts';
import type { FromWorker, LedgerLine, ToWorker } from './protocol.ts';
import { saveOf } from './save.ts';
import { clockView, tileView } from './views.ts';
import { tripsView } from './trips.ts';
import { animalPage } from './wild.ts';

type Read = Extract<
  ToWorker,
  { type: 'save' | 'export' | 'inspect' | 'item' | 'animal' | 'why' | 'trips' }
>;
type LineOf = (e: SimEvent | Stub) => LedgerLine;
type Answers = {
  [K in Read['type']]: (
    world: WorldState,
    m: Extract<Read, { type: K }>,
    line: LineOf,
  ) => FromWorker;
};

export const ANSWERS: Answers = {
  save: (world, m) => ({
    type: 'saved',
    auto: m.auto,
    ...(m.standby && { standby: true }),
    save: saveOf(world, contentHash),
    clock: clockView(world.tick),
  }),
  export: (world, m) => ({
    type: 'exported',
    kind: m.kind,
    name: `${world.seed.replace(/[^\w-]+/g, '-')}-tick-${world.tick}.ndjson`,
    segments: world.segments.map((s) => s.key),
    text: toNdjson(world.log),
  }),
  inspect: (world, m, line) => ({
    type: 'inspected',
    tile: tileView(world, m.x, m.y, m.z ?? 0, line),
  }),
  item: (world, m, line) => ({ type: 'item', item: itemView(world, m.id, line) }),
  animal: (world, m, line) => ({ type: 'animalPage', page: animalPage(world, m.id, line) }),
  trips: (world, _m, line) => ({ type: 'trips', trips: tripsView(world, line) }),
  why: (world, m, line) => ({
    type: 'causes',
    id: m.id,
    lines: whyOf(world, m.id).map(({ event, depth }) => ({ ...line(event), depth })),
  }),
};

/** Whether `m` is one of the read-only questions. */
export const isRead = (m: ToWorker): m is Read => Object.hasOwn(ANSWERS, m.type);
