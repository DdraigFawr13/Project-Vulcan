// 6B Bundle 6 (V-189 q8 and q9): each calling goes to someone who meets its bar, with a line
// saying why, and shows its push: the peacemaker's friends cool sooner, the lorekeeper's tales
// count double and are kept longer, the master teaches faster and makes a named masterwork, and
// the champion's valley loses its fear of the woods twice as fast. Nobody takes one unearned.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  callingOf,
  callingSystem,
  coolOf,
  createSim,
  createWorld,
  feedBelief,
  taleDef,
  talesSystem,
  TICKS_PER_DAY,
  type EntityRow,
} from '../index.ts';
import { teacherOf } from '../band/index.ts';
import { contextFor } from '../sim/system.ts';
import { callingDay } from './take.ts';

const sim = createSim(content);
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const living = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const skill = (w: World, p: EntityRow, id: string) =>
  w.entities['skill']!.find((s) => s['person'] === p.id && s['skill'] === id)!;

/** anvil's band with no traits, no tales and nobody near any bar, and the callings' context. */
function valley() {
  const w = createWorld(sim, 'anvil');
  w.entities['trait'] = [];
  for (const s of w.entities['skill']!) s['level'] = Math.min(s['level'] as number, 4);
  for (const p of living(w)) p['intellect'] = 8;
  const [a, b, c] = living(w) as [EntityRow, EntityRow, EntityRow];
  return { w, a, b, c, ctx: contextFor(w, sim, callingSystem) };
}

/** `p` told each of `others` a tale today, so they count as friends (colony `talkersOf`). */
const befriend = (w: World, p: EntityRow, others: EntityRow[]) => {
  const day = Math.floor(w.tick / TICKS_PER_DAY);
  for (const q of others)
    addEntity(w, 'tale', {
      person: q.id,
      story: 0,
      level: 1,
      teller: p.id,
      line: w.begunEvent,
      heard: day,
      day,
    });
};

describe('callings', () => {
  it('gives none unearned, and the peacemaker to a trusted friend of all, whose friends cool sooner', () => {
    const { w, a, b, c, ctx } = valley();
    callingDay(ctx);
    expect(lines(w, 'calling.taken')).toEqual([]);
    addEntity(w, 'trait', { person: a.id, trait: 'steady' });
    befriend(
      w,
      a,
      living(w).filter((q) => q.id !== a.id && q.id !== c.id),
    );
    callingDay(ctx);
    const [taken] = lines(w, 'calling.taken');
    expect(taken?.actors).toEqual([a.id]);
    expect(taken?.data['why']).toMatch(/steady.*most trusted.*friends with/);
    // A friend's act step cools in 4 days; someone who is not their friend keeps defy.json's 7.
    expect(coolOf(w, content, b.id)).toBe(4);
    expect(coolOf(w, content, c.id)).toBe(content.defy.cool);
  });

  it('makes a keeper of tales the lorekeeper, whose tellings are believed twice and kept twice as long', () => {
    const { w, a, b, c, ctx } = valley();
    a['intellect'] = 12;
    const story = addEntity(w, 'story', {
      tale: 'beast',
      event: w.begunEvent,
      words: '',
      about: 0,
      told: 0,
    });
    for (let i = 0; i < 12; i += 1)
      addEntity(w, 'tale', {
        person: a.id,
        story,
        level: 1,
        teller: 0,
        line: w.begunEvent,
        heard: 0,
        day: 0,
      });
    ctx.state[`tale.told@0#${a.id}`] = 30;
    callingDay(ctx);
    expect(callingOf(w, a.id)?.['calling']).toBe('lorekeeper');
    const def = taleDef(content, 'beast')!;
    const tales = contextFor(w, sim, talesSystem);
    feedBelief(tales, b.id, def, 1, false, w.begunEvent, a.id);
    feedBelief(tales, c.id, def, 1, false, w.begunEvent, b.id);
    const strength = (p: EntityRow) =>
      w.entities['belief']!.find((r) => r['person'] === p.id)?.['strength'];
    expect([strength(b), strength(c)]).toEqual([2, 1]);
    // Past forgetDays, the tale the lorekeeper told is kept; the one another told is forgotten.
    const day = 2 * content.tales.forgetDays - 1;
    w.tick = day * TICKS_PER_DAY + 30;
    w.entities['tale'] = [];
    for (const teller of [a.id, c.id])
      addEntity(w, 'tale', {
        person: b.id,
        story,
        level: 1,
        teller,
        line: w.begunEvent,
        heard: 0,
        day: day - content.tales.forgetDays - 1,
      });
    talesSystem.run!(tales);
    expect(w.entities['tale']!.filter((t) => t['person'] === b.id).map((t) => t['teller'])).toEqual(
      [a.id],
    );
  });

  it('makes a master who taught an apprentice through, who teaches at 4× and names a masterwork', () => {
    const { w, a, b, ctx } = valley();
    Object.assign(skill(w, a, 'crafting'), { level: 12, potential: 12 });
    ctx.state[`teach.finished@0#${a.id}`] = 1;
    callingDay(ctx);
    const row = callingOf(w, a.id)!;
    expect([row['calling'], row['title']]).toEqual(['master', 'the master carpenter']);
    // Their own apprentice beside them learns at the master's push, not teach.json's 3×.
    addEntity(w, 'apprentice', {
      master: a.id,
      learner: b.id,
      skill: 'crafting',
      line: w.begunEvent,
      since: 0,
      ended: 0,
    });
    for (const p of [a, b])
      Object.assign(p, { doing: 'work', job: 'craft-tools', x: 10, y: 10, z: 0 });
    expect(teacherOf(w, content, b, 'crafting', 2)?.pace).toBe(400);
    // The next piece they make is their masterwork: named, a line, and the quality raised.
    const made = ctx.emit('furniture.made', {
      causes: [row['line'] as number],
      actors: [a.id],
      data: { name: 'x', what: 'a fine chair', room: 'hall' },
    });
    const id = addEntity(w, 'furniture', { kind: 'chair', state: 'built', quality: 6, made });
    callingSystem.run!(ctx);
    const [work] = lines(w, 'calling.masterwork');
    expect(work?.causes).toContain(made);
    expect(String(work?.data['title'])).toMatch(/^the /);
    expect(w.entities['furniture']!.find((f) => f.id === id)?.['quality']).toBe(13);
  });

  it('makes a guard who fought off attackers the champion, and others fear the woods half as long', () => {
    const { w, a, b, c, ctx } = valley();
    Object.assign(skill(w, a, 'hunting'), { level: 6 });
    addEntity(w, 'memory', {
      person: a.id,
      memory: 'fought-off',
      weight: 2,
      until: w.tick + TICKS_PER_DAY,
      line: w.begunEvent,
    });
    addEntity(w, 'role', {
      person: a.id,
      role: 'guard',
      points: 4,
      why: '',
      line: w.begunEvent,
      since: 0,
    });
    callingDay(ctx);
    expect(callingOf(w, a.id)?.['calling']).toBe('champion');
    // Unfed for just over half the fade days, the belief fades for the others but not the champion.
    const half = Math.floor(content.tales.beliefFadeDays / 2) + 1;
    w.tick = (content.tales.beliefFadeDays + half) * TICKS_PER_DAY + 30;
    for (const p of [a, b, c])
      addEntity(w, 'belief', {
        person: p.id,
        belief: 'woods-dangerous',
        strength: 2,
        line: w.begunEvent,
        fed: w.tick - half * TICKS_PER_DAY,
      });
    talesSystem.run!(contextFor(w, sim, talesSystem));
    const strength = (p: EntityRow) =>
      w.entities['belief']!.find((r) => r['person'] === p.id)?.['strength'];
    expect([strength(a), strength(b), strength(c)]).toEqual([2, 1, 1]);
  });
});
