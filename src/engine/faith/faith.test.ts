// 6B Bundle 4 (P6.8, V-187): the faithful raise a shrine at the colony's first reason to gather,
// the most devout keeps it, prayer there lifts the faithful's mood (and nobody else's), a feast
// day asked for from a ledger line is kept on its day with the priest's rite, an empty store
// skips it with a line, and what a faith holds sacred leans law answers. No lever but the law.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  clockAt,
  createSim,
  createWorld,
  die,
  removeEntity,
  healthSystem,
  settingOf,
  step,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  weigh,
  whyOf,
  type EntityRow,
} from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { creedsOf, faithOf, holydaysOf, shrineOf } from './tables.ts';

const sim = createSim(content);
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const alive = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const memories = (w: World, id: string) =>
  (w.entities['memory'] ?? []).filter((m) => m['memory'] === id);

/** A world whose first reason to gather (a harvest home) has come, run until the faithful site
 * their shrine; the builders' making of it is the hearth's flow (crafts), so it is set up here. */
function withShrine(seed: string): { w: World; creed: EntityRow; shrine: EntityRow } {
  const w = createWorld(sim, seed);
  step(w, sim, TICKS_PER_HOUR);
  addEntity(w, 'feast', {
    ...{ line: w.begunEvent, year: 1, state: 'eaten', start: 0, there: [], eaten: w.begunEvent },
    ...{ couple: [], on: 0, holy: 0, lean: 0 },
  });
  const creed = creedsOf(w)[0]!;
  for (let h = 0; h < 25 && !creed['shrine']; h += 1) step(w, sim, TICKS_PER_HOUR);
  const shrine = shrineOf(w, creed)!;
  Object.assign(shrine, { state: 'built', made: creed['line'], work: 0 });
  return { w, creed, shrine };
}

describe('faith: the shrine, its priest and prayer', () => {
  it('everyone holds their people faith, and the faithful raise a shrine citing the reason', () => {
    const { w, creed, shrine } = withShrine('anvil');
    for (const p of alive(w)) expect(faithOf(w, p.id)?.['creed']).toBe(creed.id);
    expect(creed['faith']).toBe('wells');
    expect(shrine['kind']).toBe('shrine-stone');
    expect(shrine['state']).toBe('built');
    const raised = lines(w, 'faith.shrine')[0]!;
    expect(raised.causes).toContain(w.begunEvent);
    // The priest is the most devout grown holder, under the faith's own title.
    const dev = (p: EntityRow) => faithOf(w, p.id)!['devotion'] as number;
    const priest = alive(w).find((p) => p.id === creed['priest'])!;
    expect(Math.max(...alive(w).map(dev))).toBe(dev(priest));
    expect(lines(w, 'faith.priest')[0]!.data['title']).toBe('Wellkeeper');
  });

  it('prayer at the shrine lifts the mood of its faithful and of nobody else', () => {
    const { w, creed } = withShrine('smoke');
    const [faithful, other] = alive(w);
    faithOf(w, faithful!.id)!['devotion'] = 10;
    // The other holds a faith with no shrine here.
    const elsewhere = addEntity(w, 'creed', {
      ...{ faith: 'hall', name: 'The Hall', title: 'Gothi', kind: 'shrine' },
      ...{ shrine: 0, line: 0, priest: 0, named: 0 },
    });
    Object.assign(faithOf(w, other!.id)!, { creed: elsewhere, devotion: 10 });
    for (let d = 0; d < 3; d += 1) step(w, sim, TICKS_PER_DAY);
    const prayed = memories(w, content.worship.pray.memory);
    expect(prayed.some((m) => m['person'] === faithful!.id)).toBe(true);
    expect(prayed.some((m) => m['person'] === other!.id)).toBe(false);
    expect(
      content.memories.find((m) => m.id === content.worship.pray.memory)!.mood,
    ).toBeGreaterThan(0);
    expect(creed['shrine']).toBeGreaterThan(0);
  });
});

/** Moves feast day `row` to tomorrow and runs to the night after it. */
function keepTomorrow(w: World, row: EntityRow): void {
  const next = clockAt(w.tick + TICKS_PER_DAY, content.calendar);
  Object.assign(row, { month: next.month, day: next.day, kept: 0 });
  const wait = TICKS_PER_DAY - (w.tick % TICKS_PER_DAY);
  step(w, sim, wait + TICKS_PER_DAY - TICKS_PER_HOUR);
}

describe('faith: feast days', () => {
  it('a day asked for from a ledger line is kept on its day with the priest leading the rite', () => {
    const { w, creed } = withShrine('anvil');
    const cart = holydaysOf(w).find((d) => d['kind'] === 'arrival')!;
    expect(cart['state']).toBe('asked');
    const asked = lines(w, 'faith.dayAsked').find((e) => e.id === cart['line'])!;
    expect(asked.causes).toContain(cart['cause']);
    keepTomorrow(w, cart);
    const rite = lines(w, 'faith.rite')[0]!;
    expect(rite.data['name']).toBe(alive(w).find((p) => p.id === creed['priest'])!['name']);
    // The rite's why reaches back to the asking line and the history it remembers.
    const why = whyOf(w, rite.id, 20).map((c) => c.event.id);
    expect(why).toContain(cart['line']);
    expect(memories(w, 'rite-cart').length).toBeGreaterThan(0);
    expect(lines(w, 'faith.feastDay').length).toBe(1);
  });

  it('a death most grieved becomes a feast day; an empty store skips it with a line', () => {
    const { w } = withShrine('tallow');
    const dead = alive(w)[1]!;
    // Killed through the engine's own death, so the mourning memories are real.
    die(contextFor(w, sim, healthSystem), dead, 'a fall', [w.begunEvent]);
    step(w, sim, TICKS_PER_HOUR);
    const day = holydaysOf(w).find((d) => d['kind'] === 'death')!;
    expect(day['about']).toBe(dead.id);
    expect(day['state']).toBe('asked');
    // Empty the store a minute before the day comes (a day ahead, the band may bring food in
    // before it): the feast is skipped, with a line citing the asking.
    const row = holydaysOf(w).find((d) => d['kind'] === 'arrival')!;
    const next = clockAt(w.tick + TICKS_PER_DAY, content.calendar);
    Object.assign(row, { month: next.month, day: next.day, kept: 0 });
    step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY) - 1);
    const food = (w.entities['item'] ?? []).filter(
      (i) => content.life.eat[i['kind'] as string] !== undefined,
    );
    for (const i of food) removeEntity(w, 'item', i.id);
    step(w, sim, TICKS_PER_HOUR);
    const none = lines(w, 'faith.noFeast')[0];
    expect(none?.causes).toContain(row['line']);
  });
});

describe('faith: what a faith holds sacred leans the law', () => {
  it('a devout follower of the Wells, who hold kin sacred, leans against sending the sick away', () => {
    const w = createWorld(sim, 'anvil');
    step(w, sim, TICKS_PER_HOUR);
    const p = alive(w)[0]!;
    const away = content.laws.laws
      .find((l) => l.id === 'sickness')!
      .settings.find((s) => s.id === 'away')!;
    faithOf(w, p.id)!['devotion'] = 0;
    const cold = weigh(w, content, p.id, away);
    faithOf(w, p.id)!['devotion'] = 10;
    const warm = weigh(w, content, p.id, away);
    expect(cold.will - warm.will).toBe(content.worship.lean);
    expect(warm.against).toContain('the Wells holds kin sacred');
    expect(settingOf(w, content, 'feasts').id).toBe('customary');
  });
});
