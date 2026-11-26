// 6B review q7 (V-214): a valley's songs carry. On a valley with no neighbours on record (a test
// valley made from a seed word), a stranger comes by the road once songs are made there, giving
// the songs as their reason, and their coming says so. With no song, nobody comes. A chartered
// valley (V-242) is spoken of the same way, with the charter as the reason.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { addEntity, allLines, createSim, createWorld, step, TICKS_PER_DAY } from '../index.ts';
import { neighboursOf } from '../region/index.ts';

const d = game.strangers.draw;
// Every song draws someone, so the first month's first day is enough.
const content = {
  ...game,
  strangers: {
    ...game.strangers,
    draw: { ...d, fame: { ...d.fame, song: 100, byname: 0, most: 100, charter: 100 } },
  },
};
const sim = createSim(content);
// Smoke draws a newcomer by its spare food on day 28 since V-227, and tallow's song draws nobody in
// 32 days; ledger-1 holds both (searched 2026-11-23).
const SEED = 'ledger-1';
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

describe('the songs draw newcomers', () => {
  it('by the road, with the songs as their reason, only once a song is made', () => {
    expect(neighboursOf(SEED, content)).toHaveLength(0);
    const quiet = createWorld(sim, SEED);
    step(quiet, sim, 30 * TICKS_PER_DAY);
    expect(lines(quiet, 'people.drawn')).toHaveLength(0);

    const w = createWorld(sim, SEED);
    addEntity(w, 'song', {
      ...{ story: 0, name: 'The Smoke Song', bard: 0, level: 1, evenings: 1 },
      ...{ day: 0, made: 0, sung: 0 },
    });
    let days = 0;
    for (; days < 32 && !lines(w, 'people.strangerCame').length; days += 1)
      step(w, sim, TICKS_PER_DAY);
    const came = lines(w, 'people.strangerCame')[0]!;
    expect(came).toBeDefined();
    expect(came.data['words']).toBe(game.strangers.kinds.find((k) => k.id === 'song')!.words);
    expect(came.data['draw']).toContain(game.strangers.way.words);
    const lead = (w.entities['person'] ?? []).find((p) => came.actors.includes(p.id))!;
    expect(lead['reason']).toBe('song');
  });

  it('by the road for a chartered valley, with the charter as their reason', () => {
    const w = createWorld(sim, SEED);
    w.entities['lord'] = [{ id: 1, charter: 'Kararby', chartered: w.begunEvent }];
    let days = 0;
    for (; days < 32 && !lines(w, 'people.strangerCame').length; days += 1)
      step(w, sim, TICKS_PER_DAY);
    const came = lines(w, 'people.strangerCame')[0]!;
    expect(came).toBeDefined();
    expect(came.data['words']).toBe(game.strangers.kinds.find((k) => k.id === 'charter')!.words);
    expect(came.data['draw']).toContain(game.strangers.draw.fame.words);
    expect(came.data['draw']).not.toContain(game.strangers.way.words);
  });
});
