// 5B proposal 1, a hungry winter breaks new ground (V-162): a winter with enough days under the
// food plate raises the field tiles a mouth wants, with a line naming the days; a fed winter or
// one with too few short days changes nothing; the rise stops at `most`.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import {
  allLines,
  clockAt,
  createSim,
  createWorld,
  emit,
  streamFor,
  templatesOf,
  type SystemContext,
  type WorldState,
} from '../index.ts';
import { hungryWinter, moreOf } from './hungry.ts';

const DAY = 1440;
const h = content.buildings.field.hungry;
const sim = createSim(content);
const ctxOf = (w: WorldState): SystemContext => ({
  world: w,
  content,
  state: w.systems['build']!,
  rng: () => streamFor(w, 'build'),
  emit: (type, fields) => emit(w, templatesOf(content.events), type, fields),
  hooks: {},
});
const winter = (w: WorldState) =>
  content.calendar.seasons[clockAt(w.tick, content.calendar).season] === 'winter';
const foodKinds = new Set(content.items.filter((i) => i.good === 'food').map((i) => i.id));
/** Takes every bit of food out of the world, so the store is under its plate. */
function emptyStore(w: WorldState): void {
  for (const i of [...(w.entities['item'] ?? [])])
    if (foodKinds.has(i['kind'] as string)) removeEntity(w, 'item', i.id);
}
/** Fills the store to its food plate again: one stack like the band's first food. */
function filler(w: WorldState): () => void {
  const first = (w.entities['item'] ?? []).find((i) => foodKinds.has(i['kind'] as string))!;
  const plate = content.work.stock.find((s) => s.good === 'food')!;
  const count = plate.levels.find((l) => l.id === plate.start)!.count;
  return () => {
    emptyStore(w);
    const { id: _, ...row } = first;
    addEntity(w, 'item', { ...row, count });
  };
}
/** Runs the noon check daily from the world's next noon through the next winter and the first
 * day after it; `short` days of that winter (from its start) have an empty store. */
function aWinter(w: WorldState, short: number, fed: () => void): void {
  const ctx = ctxOf(w);
  w.tick += (h.hour - clockAt(w.tick, content.calendar).hour) * 60;
  while (!winter(w)) w.tick += DAY;
  for (let d = 0; winter(w); d += 1, w.tick += DAY) {
    if (d === short) fed();
    if (d < short) emptyStore(w);
    hungryWinter(ctx);
  }
  hungryWinter(ctx);
}

describe('a hungry winter breaks new ground', () => {
  it('a winter under the food plate asks for more field a mouth, naming the days', () => {
    const w = createWorld(sim, 'ledger');
    aWinter(w, h.days, filler(w));
    expect(moreOf(w.systems['build']!)).toBe(h.more);
    const said = allLines(w).filter((e) => e.type === 'field.hungryWinter');
    expect(said).toHaveLength(1);
    expect(said[0]!.data['days']).toBe(h.days);
    expect(said[0]!.data['per']).toBe(content.buildings.field.perMouth + h.more);
    expect(w.systems['build']!['fieldNeed']).toBe(said[0]!.id);
  });

  it('a winter with too few short days, or a fed one, changes nothing', () => {
    const w = createWorld(sim, 'ledger');
    const fed = filler(w);
    fed();
    aWinter(w, h.days - 1, fed);
    aWinter(w, 0, fed);
    expect(moreOf(w.systems['build']!)).toBe(0);
    expect(allLines(w).filter((e) => e.type === 'field.hungryWinter')).toHaveLength(0);
  });

  it('stops rising at most', () => {
    const w = createWorld(sim, 'ledger');
    const winters = Math.ceil(h.most / h.more) + 1;
    for (let k = 0; k < winters; k += 1) aWinter(w, 200, () => {});
    expect(moreOf(w.systems['build']!)).toBe(h.most);
    expect(allLines(w).filter((e) => e.type === 'field.hungryWinter')).toHaveLength(
      Math.ceil(h.most / h.more),
    );
  });
});
