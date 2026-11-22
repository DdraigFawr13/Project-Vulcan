// Song titles (6B Bundle 5 follow-up): one template chosen per story from the seed, filled from
// the story's words and who, when and the year; never one with a missing word; never a title the
// colony already sings while another remains.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, type EntityRow } from '../index.ts';
import { songTitle } from './titles.ts';

const sim = createSim(content);
const feast = content.tales.tales.find((t) => t.id === 'feast')!.song!;

// One world a seed: making one takes about 0.7 s at 250 tiles (V-201), and titles only read it.
const worlds = new Map<string, ReturnType<typeof createWorld>>();
const worldOf = (seed: string) =>
  worlds.get(seed) ?? worlds.set(seed, createWorld(sim, seed)).get(seed)!;

function storyIn(seed: string, id: number, words: Record<string, string | number>) {
  const world = worldOf(seed);
  const about = (world.entities['person'] ?? [])[0]!;
  const story = {
    id,
    tale: 'feast',
    event: world.begunEvent,
    words: JSON.stringify(words),
    about: about.id,
  } as EntityRow;
  return { ctx: { world, content }, story, name: about['name'] as string };
}
const words = { count: 5, meal: 'stew and loaves of bread', where: 'in the hall', dish: 'stew' };

describe('song titles', () => {
  it('the same seed and story give the same title; the feast has many', () => {
    const a = storyIn('anvil', 7, words);
    expect(songTitle(a.ctx, a.story, feast, new Set())).toBe(
      songTitle({ world: createWorld(sim, 'anvil'), content }, a.story, feast, new Set()),
    );
    const seen = new Set<string>();
    for (const seed of ['anvil', 'smoke', 'tallow', 'ledger-1'])
      for (let id = 1; id <= 6; id += 1) {
        const s = storyIn(seed, id, words);
        seen.add(songTitle(s.ctx, s.story, feast, new Set()));
      }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('fills who, the dish capitalised, the month and the year', () => {
    const s = storyIn('anvil', 1, words);
    const all = feast.map((t) => songTitle(s.ctx, s.story, [t], new Set()));
    expect(all).toContain('Stew for All');
    expect(all).toContain('The Supper in the Hall');
    expect(all).toContain(`${s.name} at the Long Table`);
    expect(all).toContain('The Harvest Home of the First Year');
    expect(all.some((t) => /^The [A-Z][a-z]+ Supper$/.test(t))).toBe(true);
    expect(all.every((t) => !t.includes('{'))).toBe(true);
  });

  it('skips a template whose word is missing, and a title already sung', () => {
    const s = storyIn('anvil', 1, { ...words, dish: '' });
    const pair = ['{Dish} for All', 'The Song of the Long Table'];
    expect(songTitle(s.ctx, s.story, pair, new Set())).toBe('The Song of the Long Table');
    const t = storyIn('anvil', 1, words);
    const two = ['The Sheaves Are In', 'The Song of the Long Table'];
    for (const taken of two)
      expect(songTitle(t.ctx, t.story, two, new Set([taken]))).not.toBe(taken);
  });
});
