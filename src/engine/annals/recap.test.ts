// The 6T review's chronicle fixes (P2 to P4): tellers speak of themselves in the first person, a
// tale comes back only when its version changed and two different tellings stand side by side;
// each season looks ahead; troubles go by danger, small ones that come back fold into one line of
// the year, whose title is its biggest loss or turn; and a name takes no "the".
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { namesTakeNoThe, the, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { createSim, createWorld } from '../index.ts';
import { renderEvent } from '../log/index.ts';
import { aheadOf } from './ahead.ts';
import { firstPerson, sayOf } from './say.ts';

const self = content.annals.say.self;

describe('first person', () => {
  it('turns the teller into I, me and my, and leaves others alone', () => {
    const cases: [string, string, string][] = [
      ['Grainne was bitten by a wolf.', 'Grainne', 'I was bitten by a wolf.'],
      ['Domnall has taken a chill.', 'Domnall', 'I have taken a chill.'],
      ['Ann is a little poorly.', 'Ann', 'I am a little poorly.'],
      [
        "Godwin smashed a stool over Aldith's head.",
        'Aldith',
        'Godwin smashed a stool over my head.',
      ],
      [
        'A wolf went for Bran, who only just got away.',
        'Bran',
        'A wolf went for me, and I only just got away.',
      ],
      [
        'Etain fell in the shaft: a deep break to her left leg.',
        'Etain',
        'I fell in the shaft: a deep break to my left leg.',
      ],
      ['Ann and Bryn had words.', 'Ann', 'Bryn and I had words.'],
      ['Ann and Bryn had words.', 'Bryn', 'Ann and I had words.'],
      ['Ann came to blows with Bryn.', 'Bryn', 'Ann came to blows with me.'],
      ['The feast went on all night.', 'Ann', 'The feast went on all night.'],
      ['Annwen has taken a chill.', 'Ann', 'Annwen has taken a chill.'],
    ];
    for (const [text, name, want] of cases) expect(firstPerson(text, name, self), text).toBe(want);
  });
});

describe('a name takes no "the"', () => {
  it('in a ledger line and in code', () => {
    const templates = new Map([['t', 'Cold in the {room}; the {what} broke.']]);
    const line = (room: string) =>
      renderEvent(
        {
          id: 1,
          tick: 0,
          type: 't',
          actors: [],
          subjects: [],
          causes: [],
          data: { room, what: 'axe' },
        },
        templates,
      );
    expect(line("Aldith's home")).toBe("Cold in Aldith's home; the axe broke.");
    expect(line('cottage')).toBe('Cold in the cottage; the axe broke.');
    expect(the("Deirdre and Ciaran's home")).toBe("Deirdre and Ciaran's home");
    expect(the('hall')).toBe('the hall');
    expect(namesTakeNoThe('The {room} is warm.', () => true)).toBe('{room} is warm.');
    // A capital alone is no such name: "the Rations law" keeps its "the".
    const law = new Map([['l', 'They ask that the {law} be eased.']]);
    const asked = {
      id: 1,
      tick: 0,
      type: 'l',
      actors: [],
      subjects: [],
      causes: [],
      data: { law: 'Rations law' },
    };
    expect(renderEvent(asked, law)).toBe('They ask that the Rations law be eased.');
    expect(the('The Plough')).toBe('The Plough');
  });
});

// A small world of rows for what people say: three people, one story held at two levels.
function talesWorld(levels: number[]): WorldState {
  const person = ['Ann', 'Bryn', 'Cai'].map((name, i) => ({ id: i + 1, name, status: 'alive' }));
  const story = [
    {
      id: 10,
      tale: 'beast',
      event: 5,
      words: JSON.stringify({ name: 'Ann', species: 'wolf' }),
      about: 1,
      told: 0,
    },
  ];
  const tale = levels.map((level, i) => ({
    id: 20 + i,
    person: i + 1,
    story: 10,
    level,
    line: 30 + i,
  }));
  return { entities: { person, story, tale } } as unknown as WorldState;
}

describe('what people say', () => {
  it('sets two different tellings side by side, each teller in their own words', () => {
    const [s] = sayOf(talesWorld([1, 3]), content, 0, new Map());
    expect(s!.text).toBe(
      'Bryn tells it: "A whole pack set on Ann, who by rights should be dead." ' +
        'Ann tells it another way: "A wolf went for me."',
    );
    expect(s!.lines).toEqual([31, 30]);
  });

  it('says a tale again only once its version has changed', () => {
    const world = talesWorld([1, 1]);
    const [first] = sayOf(world, content, 0, new Map());
    expect(first!.text).toBe('Ann tells it: "A wolf went for me."');
    expect(sayOf(world, content, 0, new Map([[10, first!.level]]))).toEqual([]);
    (world.entities['tale']![1] as EntityRow)['level'] = 2;
    expect(sayOf(world, content, 0, new Map([[10, first!.level]]))).toHaveLength(1);
  });
});

describe('looking ahead', () => {
  const world = createWorld(createSim(content), 'anvil');
  const turn = world.log[0]!.id;

  it('weighs the store against the harvest, and names who lies sick and a hungry pack', () => {
    const [food] = aheadOf(world, content, [], turn);
    expect(food!.text).toMatch(/^The store (should last until|will run out .* before) the harvest/);
    expect(food!.lines).toEqual([turn]);
    const ann = world.entities['person']![0]!;
    addEntity(world, 'ill', { person: ann.id, ill: 'chill', state: 'sick', line: turn });
    const sick = aheadOf(world, content, [], turn).find((s) => s.text.includes('sick'));
    expect(sick?.text).toBe(`${ann['name'] as string} still lies sick with a chill.`);
  });

  it('says the smith still has no metal after a season of waiting for it', () => {
    const lack = {
      id: 1,
      event: turn,
      type: 'smith.noIngots',
      words: '{}',
      actors: [],
      year: 1,
      season: 0,
    };
    const said = aheadOf(world, content, [lack], turn).map((s) => s.text);
    expect(said).toContain(content.annals.ahead.smith);
  });
});
