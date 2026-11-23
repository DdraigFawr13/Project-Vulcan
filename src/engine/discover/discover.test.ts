// 6C Slice 5 (V-142, V-218): a smith at the forge begins to puzzle over steel, gathers its hints
// and finds it, the find's line citing every hint; a lucky night writes its line; nobody puzzles
// over a way a living colonist knows; a puzzle put aside keeps its hints when taken up again.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  discoverSystem,
  renderEvent,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  type EngineContent,
  type EntityRow,
} from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { knows, puzzleOf } from './tables.ts';

type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const living = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** anvil's band with its first person a smith at smithing 7, at the forge every hour. */
function forge(c: EngineContent = content) {
  const sim = createSim(c);
  const w = createWorld(sim, 'anvil');
  const [smith] = living(w) as [EntityRow];
  const row = w.entities['skill']!.find(
    (s) => s['person'] === smith.id && s['skill'] === 'smithing',
  );
  if (row) row['level'] = 7;
  else addEntity(w, 'skill', { person: smith.id, skill: 'smithing', level: 7, potential: 10 });
  const ctx = contextFor(w, sim, discoverSystem);
  const hours = (n: number, doing = 'work') => {
    for (let h = 0; h < n; h += 1) {
      w.tick += TICKS_PER_HOUR;
      Object.assign(smith, { doing, job: 'smith' });
      discoverSystem.run!(ctx);
    }
  };
  const text = (e: { id: number }) =>
    renderEvent(
      allLines(w).find((x) => x.id === e.id)!,
      sim.templates,
    );
  return { w, smith, ctx, hours, text };
}

describe('hints and breakthroughs', () => {
  it('a smith with the hints for steel finds it, the line citing each hint', () => {
    const { w, smith, hours, text } = forge();
    hours(3 * 24);
    const begun = lines(w, 'discover.puzzle');
    expect(begun.map((e) => [e.actors[0], e.data['method']])).toEqual([[smith.id, 'steel']]);
    hours(content.methods.work * 5);
    const [found] = lines(w, 'discover.found');
    const hints = lines(w, 'discover.hint').filter((e) => e.id < found!.id);
    expect(hints.length).toBe(5);
    expect(hints.every((e) => e.actors[0] === smith.id)).toBe(true);
    expect(found!.causes).toEqual(hints.map((e) => e.id));
    expect(text(found!)).toContain('long hours at the forge');
    expect(knows(w, smith.id, 'steel')).toBe(true);
    expect(puzzleOf(w, smith.id)).toBeUndefined();
  });

  it('a lucky night writes its line', () => {
    const luck = { ...content.methods.luck, days: 1, lucky: 1 };
    const { w, smith, hours, text } = forge({ ...content, methods: { ...content.methods, luck } });
    hours(3 * 24 + 8);
    // The first midnight after the puzzle began, a day at the forge was lucky.
    w.tick = Math.ceil(w.tick / TICKS_PER_DAY) * TICKS_PER_DAY - TICKS_PER_HOUR;
    hours(1);
    const lucky = lines(w, 'discover.hint').filter((e) => e.data['kind'] === 'luck');
    expect(lucky.length).toBeGreaterThan(0);
    expect(lucky[0]!.actors).toEqual([smith.id]);
    expect(text(lucky[0]!)).toContain('by luck at the forge');
  });

  it('nobody puzzles over a way a living colonist knows', () => {
    const { w, smith, hours } = forge();
    const other = living(w).find((p) => p.id !== smith.id)!;
    addEntity(w, 'knows', { person: other.id, method: 'steel', how: 'found', line: 1, from: 0 });
    hours(3 * 24);
    expect(lines(w, 'discover.puzzle')).toEqual([]);
  });

  it('a puzzle left two months for other work is put aside, but not one left a month', () => {
    const { w, smith, hours } = forge();
    hours(3 * 24);
    hours(content.methods.drop.days * 24 + 24, '');
    expect(lines(w, 'discover.dropped')).toEqual([]);
    hours(content.methods.drop.days * 24 + 24, '');
    const [put] = lines(w, 'discover.dropped');
    expect(put?.actors).toEqual([smith.id]);
    expect(put?.causes).toEqual([lines(w, 'discover.puzzle')[0]!.id]);
    expect(puzzleOf(w, smith.id)).toBeUndefined();
  });

  it('a puzzle put aside and taken up again keeps its hints (V-228)', () => {
    const { w, smith, hours, text } = forge();
    hours(3 * 24 + content.methods.work);
    const kept = lines(w, 'discover.hint').length;
    expect(kept).toBeGreaterThan(0);
    hours(2 * (content.methods.drop.days * 24 + 24), '');
    expect(lines(w, 'discover.dropped')).toHaveLength(1);
    hours(3 * 24);
    const [again] = lines(w, 'discover.resumed');
    expect(again?.causes).toContain(lines(w, 'discover.dropped')[0]!.id);
    expect(text(again!)).toContain(`with ${kept} of`);
    expect(lines(w, 'discover.puzzle')).toHaveLength(1);
    const q = puzzleOf(w, smith.id)!;
    expect((w.entities['hint'] ?? []).filter((h) => h['puzzle'] === q.id)).toHaveLength(kept);
  });
});
