// P6.3, V-155: one rumour traced across three colonists, changing as it goes. Bran sees a wolf go
// for him; at leisure he tells Cai, who tells Dilys, each telling one level worse (bends forced
// here), each line citing the one before, so "why?" walks from Dilys's version to the attack.
// Beliefs form from the version held: seen counts 2, heard 1. Only the tales system runs after
// the world is made, so the people stand where the test puts them.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  allLines,
  beliefsOf,
  bynameOf,
  createSim,
  createWorld,
  emit,
  step,
  storiesOf,
  talesOf,
  talesSystem,
  taleText,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  whyOf,
  type EntityRow,
} from '../index.ts';

const tuned = {
  ...content,
  tales: {
    ...content.tales,
    pass: { meal: 100, leisure: 100, work: 100, hearth: 100, tavern: 100, perDay: 2 },
    bend: { chance: 100, traits: {}, softer: 0 },
    byname: { ...content.tales.byname, told: 3 },
  },
};
const full = createSim(tuned);
const talesOnly = createSim(tuned, [talesSystem]);

function setUp() {
  const w = createWorld(full, 'anvil');
  const people = (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
  // Everyone asleep far apart; each scene wakes only the two who talk.
  people.forEach((p, k) => Object.assign(p, { doing: 'sleep', x: 10 + 20 * k, y: 10, z: 0 }));
  const meet = (a: EntityRow, b: EntityRow) => {
    people.forEach((p) => (p['doing'] = 'sleep'));
    Object.assign(a, { doing: 'relax', x: 50, y: 50 });
    Object.assign(b, { doing: 'relax', x: 51, y: 50 });
  };
  /** Runs the tales system past the next half hour, when tales pass. */
  const nextTelling = () => {
    const half = TICKS_PER_HOUR / 2;
    const wait = (half - (w.tick % TICKS_PER_HOUR) + TICKS_PER_HOUR) % TICKS_PER_HOUR;
    step(w, talesOnly, wait || TICKS_PER_HOUR);
  };
  /** A wolf goes for `p`, seen by no one else (all asleep). */
  const attack = (p: EntityRow) =>
    emit(w, full.templates, 'wild.attacked', {
      actors: [p.id],
      causes: [w.begunEvent],
      data: {
        species: 'wolf',
        name: p['name'] as string,
        why: 'at the wood edge',
        fight: '',
        bitten: '',
      },
    });
  return {
    w,
    people: people as [EntityRow, EntityRow, EntityRow, ...EntityRow[]],
    meet,
    nextTelling,
    attack,
  };
}

describe('tales', () => {
  it('passes one rumour across three colonists, worse at each telling, back to the event', () => {
    const { w, people, meet, nextTelling, attack } = setUp();
    const [bran, cai, dilys] = people;
    const seen = attack(bran);
    step(w, talesOnly, 1);
    expect(talesOf(w, bran.id).map((t) => t['level'])).toEqual([1]);
    expect(talesOf(w, cai.id)).toEqual([]);
    meet(bran, cai);
    nextTelling();
    meet(cai, dilys);
    nextTelling();
    const [b, c, d] = [bran, cai, dilys].map((p) => talesOf(w, p.id)[0]!) as [
      EntityRow,
      EntityRow,
      EntityRow,
    ];
    expect([b, c, d].map((t) => t['level'])).toEqual([1, 2, 3]);
    expect([b, c, d].map((t) => t['teller'])).toEqual([0, bran.id, cai.id]);
    const story = storiesOf(w)[0]!;
    const words = [b, c, d].map((t) => taleText(tuned, story, t['level'] as number));
    expect(new Set(words).size).toBe(3);
    expect(words[2]).toMatch(/pack/);
    // Dilys's version cites Cai's telling, which cites Bran's seeing.
    const told = allLines(w).filter((e) => e.type === 'tale.told');
    expect(told.map((e) => e.data['bent'])).toEqual([
      ' It grew in the telling.',
      ' It grew in the telling.',
    ]);
    expect(d['line']).toBe(told[1]!.id);
    expect(whyOf(w, d['line'] as number).map((c) => c.event.id)).toEqual(
      expect.arrayContaining([told[0]!.id, seen]),
    );
    // Seen: 2 steps; heard: 1 each. The woods are dangerous to all three.
    for (const [p, strength] of [
      [bran, 2],
      [cai, 1],
      [dilys, 1],
    ] as const)
      expect(beliefsOf(w, p.id).map((x) => [x['belief'], x['strength']])).toEqual([
        ['woods-dangerous', strength],
      ]);
  });

  it('tells no one a tale they hold, and nobody asleep hears one', () => {
    const { w, people, meet, nextTelling, attack } = setUp();
    const [bran, cai, dilys] = people;
    attack(bran);
    step(w, talesOnly, 1);
    meet(bran, cai);
    nextTelling();
    nextTelling();
    expect(talesOf(w, cai.id)).toHaveLength(1);
    expect(talesOf(w, dilys.id)).toEqual([]);
    expect(allLines(w).filter((e) => e.type === 'tale.told')).toHaveLength(1);
  });

  it('lets nobody hear more than perDay new tales in a day', () => {
    const { w, people, meet, nextTelling, attack } = setUp();
    const [bran, cai] = people;
    // Start of a day, so the three hours of telling fall inside it.
    step(w, talesOnly, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY));
    for (let k = 0; k < 3; k += 1) attack(bran);
    step(w, talesOnly, 1);
    meet(bran, cai);
    for (let k = 0; k < 3; k += 1) nextTelling();
    expect(talesOf(w, bran.id)).toHaveLength(3);
    expect(talesOf(w, cai.id)).toHaveLength(tuned.tales.pass.perDay);
  });

  it('forgets a tale heard and left untold, never one seen', () => {
    const { w, people, meet, nextTelling, attack } = setUp();
    const [bran, cai] = people;
    attack(bran);
    step(w, talesOnly, 1);
    meet(bran, cai);
    nextTelling();
    expect(talesOf(w, cai.id)).toHaveLength(1);
    people.forEach((p) => (p['doing'] = 'sleep'));
    step(w, talesOnly, (tuned.tales.forgetDays + 1) * TICKS_PER_DAY);
    expect(talesOf(w, cai.id)).toEqual([]);
    expect(talesOf(w, bran.id)).toHaveLength(1);
    expect(storiesOf(w)).toHaveLength(1);
  });

  it('drops the tales of the dead, keeping the story while the living hold it', () => {
    const { w, people, meet, nextTelling, attack } = setUp();
    const [bran, cai] = people;
    attack(bran);
    step(w, talesOnly, 1);
    meet(bran, cai);
    nextTelling();
    bran['status'] = 'dead';
    step(w, talesOnly, TICKS_PER_DAY);
    expect(talesOf(w, bran.id)).toEqual([]);
    expect(talesOf(w, cai.id)).toHaveLength(1);
    expect(storiesOf(w)).toHaveLength(1);
  });

  it('names someone by the version most hold, the line citing the latest telling', () => {
    const { w, people, meet, nextTelling, attack } = setUp();
    const [bran, cai, dilys, ewan] = people as [EntityRow, EntityRow, EntityRow, EntityRow];
    attack(bran);
    step(w, talesOnly, 1);
    for (const [a, b] of [
      [bran, cai],
      [cai, dilys],
      [dilys, ewan],
    ] as const) {
      meet(a, b);
      nextTelling();
    }
    people.forEach((p) => (p['doing'] = 'sleep'));
    expect(allLines(w).filter((e) => e.type === 'tale.byname')).toEqual([]);
    step(w, talesOnly, TICKS_PER_DAY);
    const named = allLines(w).filter((e) => e.type === 'tale.byname');
    const told = allLines(w).filter((e) => e.type === 'tale.told');
    expect(named).toHaveLength(1);
    expect(named[0]!.actors).toEqual([bran.id]);
    expect(named[0]!.data['word']).toBe('Wolfbait');
    expect(named[0]!.causes).toEqual([told.at(-1)!.id]);
    expect(bynameOf(w, bran.id)!['word']).toBe('Wolfbait');
    expect(
      (w.entities['memory'] ?? []).some(
        (m) => m['person'] === bran.id && m['memory'] === 'byname-stung',
      ),
    ).toBe(true);
    // One for life: another day brings no second.
    step(w, talesOnly, TICKS_PER_DAY);
    expect(allLines(w).filter((e) => e.type === 'tale.byname')).toHaveLength(1);
  });
});
