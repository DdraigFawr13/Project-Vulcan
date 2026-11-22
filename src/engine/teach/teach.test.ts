// 6B Bundle 6 (P6.13, V-074, V-141, V-189): an apprentice beside their master levels faster than
// one practising alone and can be taught past their gift; a master keeping the Apprentices law
// takes an apprentice with a line citing it, and the ledger names who taught whom; a master who
// dies with nobody near them takes their skill, citing the death.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  die,
  healthSystem,
  step,
  submitCommand,
  teachSystem,
  TICKS_PER_DAY,
  type EntityRow,
} from '../index.ts';
import { practise } from '../band/index.ts';
import { contextFor } from '../sim/system.ts';
import { apprenticeDay } from './bond.ts';
import { takeUpHelping } from './help.ts';
import { lossHour } from './loss.ts';
import { recordTaught } from './record.ts';
import { taughtOf } from './tables.ts';

const sim = createSim(content);
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const people = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const row = (w: World, p: EntityRow, skill: string) =>
  w.entities['skill']!.find((s) => s['person'] === p.id && s['skill'] === skill)!;

/** anvil's band with Colm (crafting 10) the master, two learners at crafting `level` of `gift`
 * with no traits, the first beside Colm and the second far off, everyone at work making tools. */
function workshop(level: number, gift: number) {
  const w = createWorld(sim, 'anvil');
  const [master, near, far] = people(w).sort(
    (a, b) =>
      (row(w, b, 'crafting')['level'] as number) - (row(w, a, 'crafting')['level'] as number),
  ) as [EntityRow, EntityRow, EntityRow];
  w.entities['trait'] = [];
  for (const p of [near, far])
    Object.assign(row(w, p, 'crafting'), { level, potential: gift, xp: 0 });
  for (const p of [master, near, far])
    Object.assign(p, { doing: 'work', job: 'craft-tools', z: 0 });
  Object.assign(near, { x: (master['x'] as number) + 1, y: master['y'] });
  // The master has worked at crafting, so it is the skill they would teach.
  row(w, master, 'crafting')['used'] = 600;
  Object.assign(far, { x: (master['x'] as number) + 40, y: master['y'] });
  return { w, master, near, far, ctx: contextFor(w, sim, teachSystem) };
}

describe('teaching', () => {
  it('has an apprentice beside their master level faster than one alone, past their gift', () => {
    const { w, master, near, far, ctx } = workshop(2, 4);
    expect(row(w, master, 'crafting')['level']).toBeGreaterThanOrEqual(content.teach.master);
    addEntity(w, 'apprentice', {
      ...{ master: master.id, learner: near.id, skill: 'crafting' },
      ...{ line: w.begunEvent, since: 0, ended: 0 },
    });
    for (let m = 0; m < 3000; m += 1) {
      practise(ctx, near, 'crafting', 0);
      practise(ctx, far, 'crafting', 0);
    }
    // Alone, the far one stops at their gift (4); taught, the apprentice goes 2 past it.
    expect(row(w, far, 'crafting')['level']).toBe(4);
    expect(row(w, near, 'crafting')['level']).toBe(4 + content.teach.past);
    const taught = lines(w, 'skill.taught');
    expect(taught.length).toBeGreaterThan(0);
    expect(taught.every((e) => e.actors[0] === near.id && e.actors[1] === master.id)).toBe(true);
    recordTaught(ctx);
    const record = taughtOf(w).find((r) => r['learner'] === near.id)!;
    expect([record['teacher'], record['from'], record['to']]).toEqual([master.id, 2, 6]);
  });

  it('learns faster beside an apprentice’s master: fewer minutes to the same level', () => {
    const { w, master, near, far, ctx } = workshop(2, 12);
    addEntity(w, 'apprentice', {
      ...{ master: master.id, learner: near.id, skill: 'crafting' },
      ...{ line: w.begunEvent, since: 0, ended: 0 },
    });
    for (let m = 0; m < 1200; m += 1) {
      practise(ctx, near, 'crafting', 0);
      practise(ctx, far, 'crafting', 0);
    }
    expect(row(w, near, 'crafting')['level']).toBeGreaterThan(
      row(w, far, 'crafting')['level'] as number,
    );
  });

  it('has a free apprentice work beside their master, unless their Priorities put other work first', () => {
    const { w, master, far, ctx } = workshop(2, 12);
    master['job'] = 'carpentry';
    Object.assign(far, { doing: 'work', job: '', x: (master['x'] as number) - 4 });
    addEntity(w, 'apprentice', {
      ...{ master: master.id, learner: far.id, skill: 'crafting' },
      ...{ line: w.begunEvent, since: 0, ended: 0 },
    });
    // Felling put first on their own Priorities: they go to that, not to their master (V-041).
    addEntity(w, 'priority', { person: far.id, job: 'fell', level: 1, line: 0, declined: 0 });
    expect(takeUpHelping(ctx, far)).toBe(false);
    w.entities['priority'] = [];
    // Level with their best: they walk over, and once beside practise at the apprentice pace.
    expect(takeUpHelping(ctx, far)).toBe(true);
    expect([far['job'], far['took'], (far['path'] as number[]).length > 0]).toEqual([
      'help',
      w.begunEvent,
      true,
    ]);
    Object.assign(far, { x: (master['x'] as number) + 1, path: [] });
    const xp = row(w, far, 'crafting')['xp'] as number;
    expect(takeUpHelping(ctx, far)).toBe(true);
    expect(row(w, far, 'crafting')['xp']).toBe(xp + content.teach.apprentice);
  });

  it('has a master keeping Every master takes one take an apprentice, citing the law', () => {
    const { w, master, near, ctx } = workshop(2, 12);
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setLaw',
      data: { law: 'apprentices', setting: 'all' },
    });
    step(w, sim, 2);
    const keeps = (w.entities['answer'] ?? []).find(
      (a) => a['person'] === master.id && a['law'] === 'apprentices',
    );
    if (keeps) keeps['answer'] = 'obeys';
    apprenticeDay(ctx);
    const took = lines(w, 'teach.apprentice').find((e) => e.actors[0] === master.id)!;
    expect(took.data['why']).toBe(content.teach.words.law);
    expect(took.causes).toContain(lines(w, 'law.set').at(-1)!.id);
    expect(took.actors[1]).toBeDefined();
    expect(near.id).toBeGreaterThan(0);
  });

  it('has a master who dies with nobody near their level take their skill, citing the death', () => {
    const { w, master, ctx } = workshop(2, 12);
    lossHour(ctx);
    const dead = die(contextFor(w, sim, healthSystem), master, 'a fall', [w.begunEvent]);
    lossHour(ctx);
    const lost = lines(w, 'teach.lost').find((e) => e.actors[0] === master.id)!;
    expect(lost.data['skill']).toBe('crafting');
    expect(lost.causes).toEqual([dead]);
  });

  // 6B review q1 (V-207): a tale-swapping friend counts, and every "why?" leads somewhere.
  it('has a master by choice take a friend they swap tales with, citing the tale', () => {
    const { w, master, near, ctx } = workshop(2, 12);
    const day = Math.floor(w.tick / TICKS_PER_DAY);
    const told = w.begunEvent;
    addEntity(w, 'tale', {
      ...{ person: near.id, story: 0, level: 1, teller: master.id, line: told },
      ...{ heard: day, day },
    });
    apprenticeDay(ctx);
    const took = lines(w, 'teach.apprentice').find((e) => e.actors[0] === master.id)!;
    expect(took.actors[1]).toBe(near.id);
    expect(took.data['why']).toBe(
      content.teach.words.talker.replace('{learner}', near['name'] as string),
    );
    expect(took.causes).toEqual([told]);
  });

  it('has a master who chose by their trait cite their skill or their coming', () => {
    const { w, master, ctx } = workshop(2, 12);
    addEntity(w, 'trait', { person: master.id, trait: content.teach.choose[0]! });
    apprenticeDay(ctx);
    const took = lines(w, 'teach.apprentice').find((e) => e.actors[0] === master.id)!;
    expect(took.causes.length).toBe(1);
    const cited = allLines(w).find((e) => e.id === took.causes[0])!;
    expect(['skill.rose', 'skill.taught', 'people.arrived']).toContain(cited.type);
  });

  it('has a master gone with no death line cite their skill or their coming', () => {
    const { w, master, ctx } = workshop(2, 12);
    lossHour(ctx);
    master['status'] = 'dead';
    lossHour(ctx);
    const lost = lines(w, 'teach.lost').find((e) => e.actors[0] === master.id)!;
    expect(lost.causes.length).toBe(1);
    expect(lost.causes[0]).toBeGreaterThan(0);
  });
});
