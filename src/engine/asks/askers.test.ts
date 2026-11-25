// 6C Slice 3 (V-225): the other askers. A stranger come with their village's trouble asks for it,
// citing their coming; on its day the village's regard moves with a line (done, a gift comes back
// with its next stranger); at a harvest home the shrine's priest asks for what the faith holds
// sacred, worked by its faithful only; letting it pass gives the faithful a sour memory.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  emit,
  itemsOf,
  restOf,
  step,
  submitCommand,
  TICKS_PER_HOUR,
  today,
  withoutAccidents,
  yearNow,
} from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { willWork } from '../crafts/askmade.ts';
import { asksSystem } from './system.ts';
import { sendBack } from '../band/index.ts';

const content = withoutAccidents(game);
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const people = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const asks = (w: World) => w.entities['ask'] ?? [];

function start() {
  const sim = createSim(content);
  const w = createWorld(sim, 'ledger');
  return { sim, w, ctx: contextFor(w, sim, asksSystem) };
}

describe('a neighbouring village', () => {
  it('asks when its stranger comes, and its regard moves on the day with a line', () => {
    const { sim, w } = start();
    const [a, b] = people(w);
    const came = emit(w, sim.templates, 'people.strangerCame', {
      causes: [w.begunEvent],
      data: { names: 'Wyn', place: 'Oakby', dir: 'east', bundle: '', words: '', draw: '' },
    });
    Object.assign(a!, { stranger: came, reason: 'sickness', home: 'Oakby' });
    step(w, sim, 2);
    const [asked] = lines(w, 'neighbour.asked');
    expect(asked!.causes).toContain(came);
    const ask = asks(w).find((x) => x['source'] === 'neighbour')!;
    expect(ask['of']).toBe('Oakby');
    expect(ask['good']).toBe('herbs');
    // Let pass; its day comes.
    submitCommand(w, { tick: w.tick + 1, kind: 'passAsk', data: { ask: ask.id } });
    step(w, sim, 2);
    ask['due'] = w.tick + 1;
    step(w, sim, TICKS_PER_HOUR);
    const [passed] = lines(w, 'ask.passed');
    const [fell] = lines(w, 'ask.regard');
    expect(fell!.causes).toContain(passed!.id);
    expect(fell!.data['way']).toBe('falls');
    expect(fell!.data['regard']).toBe(
      String(content.asks.regard.start + content.asks.regard.passed),
    );
    // A year on (the first ask set back a year), the next ask is done: the regard rises and the
    // village's next stranger brings a gift.
    ask['due'] = -400 * 1440;
    const again = emit(w, sim.templates, 'people.strangerCame', {
      causes: [w.begunEvent],
      data: { names: 'Wyn', place: 'Oakby', dir: 'east', bundle: '', words: '', draw: '' },
    });
    Object.assign(b!, { stranger: again, reason: 'hunger', home: 'Oakby' });
    step(w, sim, 2);
    const second = asks(w).filter((x) => x['source'] === 'neighbour')[1]!;
    Object.assign(second, { state: 'taken', level: 1, got: second['count'], due: w.tick + 1 });
    step(w, sim, TICKS_PER_HOUR);
    const done = lines(w, 'ask.done').at(-1)!;
    expect(lines(w, 'ask.regard').at(-1)!.causes).toContain(done.id);
    const third = emit(w, sim.templates, 'people.strangerCame', {
      causes: [w.begunEvent],
      data: { names: 'Wyn', place: 'Oakby', dir: 'east', bundle: '', words: '', draw: '' },
    });
    a!['stranger'] = third;
    step(w, sim, 2);
    const [gift] = lines(w, 'ask.gift');
    expect(gift!.causes).toEqual([done.id, third]);
  });
});

describe("the shrine's priest", () => {
  it('asks at harvest home citing it, worked by the faithful only; passing sours them', () => {
    const { sim, w, ctx } = start();
    const [priest, other] = people(w);
    const spot = restOf(w, content);
    const shrine = addEntity(w, 'furniture', {
      ...{ kind: 'shrine', x: spot.x + 2, y: spot.y, z: 0, facing: 's', quality: 0, maker: 0 },
      ...{ owner: 0, made: w.begunEvent, line: w.begunEvent, state: 'built', have: 0, work: 0 },
      waited: 0,
    });
    const creed = addEntity(w, 'creed', {
      ...{ faith: 'wells', name: 'The Wells', title: 'Wellkeeper', kind: 'shrine' },
      ...{ shrine, line: w.begunEvent, priest: priest!.id, named: w.begunEvent },
    });
    w.entities['faithful'] = [];
    addEntity(w, 'faithful', { person: priest!.id, creed, devotion: 8, prayed: 0, until: 0 });
    // The rest hold no creed here (a row of their own, so none is given them).
    for (const p of people(w).slice(1))
      addEntity(w, 'faithful', { person: p.id, creed: 0, devotion: 0, prayed: 0, until: 0 });
    const home = () => {
      const line = emit(w, sim.templates, 'farm.harvestHome', {
        causes: [w.begunEvent],
        data: { names: 'the band', crop: 'turnips', count: 2000, what: 'turnips' },
      });
      addEntity(w, 'feast', {
        ...{ line, year: yearNow(w, content), state: 'eaten', start: 0, there: [] },
        ...{ eaten: line, couple: [], on: today(w), holy: 0, lean: 0 },
      });
      return line;
    };
    const first = home();
    step(w, sim, TICKS_PER_HOUR);
    const [asked] = lines(w, 'faith.asked');
    expect(asked!.causes).toContain(first);
    const ask = asks(w).find((x) => x['source'] === 'faith')!;
    // The Wells hold kin sacred first: food for a second feast.
    expect(ask['good']).toBe('food');
    expect(willWork(ctx, priest!, ask)).toBe(true);
    expect(willWork(ctx, other!, ask)).toBe(false);
    submitCommand(w, { tick: w.tick + 1, kind: 'passAsk', data: { ask: ask.id } });
    step(w, sim, 2);
    home();
    step(w, sim, TICKS_PER_HOUR);
    const [passed] = lines(w, 'ask.passed');
    expect(passed!.causes).toContain(asked!.id);
    const sour = (w.entities['memory'] ?? []).filter(
      (m) => m['memory'] === content.asks.shrine.passed,
    );
    expect(sour.map((m) => m['person'])).toEqual([priest!.id]);
    expect(sour[0]!['line']).toBe(passed!.id);
  });
});

describe('a turned-away stranger', () => {
  it('asks to stay a season citing the turning away; taken up, they stay, then are talked over', () => {
    const { sim, w, ctx } = start();
    const [guest, against, ...rest] = people(w);
    const came = emit(w, sim.templates, 'people.strangerCame', {
      causes: [w.begunEvent],
      data: { names: 'Wyn', place: 'Oakby', dir: 'east', bundle: '', words: '', draw: '' },
    });
    // The rest spoke for them; `against` did not.
    const away = emit(w, sim.templates, 'people.strangerTurnedAway', {
      causes: [came],
      actors: [guest!.id],
      data: {
        ...{ names: 'Wyn of Oakby', spoke: '', why: '', verb: 'was', dir: 'east' },
        spokeFor: rest.map((p) => p.id).join('|'),
      },
    });
    Object.assign(guest!, { status: 'stranger', stranger: came, waits: -1, guest: 0 });
    Object.assign(guest!, { reason: 'hunger', home: 'Oakby', homeDir: 'east', partner: 0 });
    sendBack(ctx, [guest!]);
    step(w, sim, 2);
    const [asked] = lines(w, 'guest.asked');
    expect(asked!.causes).toContain(away);
    const ask = asks(w).find((x) => x['source'] === 'guest')!;
    submitCommand(w, { tick: w.tick + 1, kind: 'takeAsk', data: { ask: ask.id, level: 2 } });
    step(w, sim, 3);
    const [stays] = lines(w, 'guest.stays');
    expect(stays!.actors).toEqual([guest!.id]);
    expect(guest!['status']).toBe('alive');
    const sour = (w.entities['memory'] ?? []).filter(
      (m) => m['memory'] === content.asks.guests.against,
    );
    expect(sour.map((m) => m['person'])).toEqual([against!.id]);
    // The season ends: a tale, then the colony's word on them again.
    ask['due'] = w.tick + 1;
    step(w, sim, 5);
    const [tale] = lines(w, 'guest.tale');
    expect(tale!.causes).toContain(asked!.id);
    const word = [...lines(w, 'people.strangerStays'), ...lines(w, 'people.strangerTurnedAway')];
    expect(word.some((e) => e.id > tale!.id && e.actors.includes(guest!.id))).toBe(true);
  });
});

describe('a dream long unfulfilled', () => {
  it('asks to be backed citing the ambition, worked by its trade; passing sours the dreamer', () => {
    const { sim, w, ctx } = start();
    const [dreamer, mate, other] = people(w);
    w.entities['skill'] = (w.entities['skill'] ?? []).filter((s) => s['skill'] !== 'herbalism');
    addEntity(w, 'skill', { person: mate!.id, skill: 'herbalism', level: 3, xp: 0 });
    const since = w.tick - (content.asks.dreams.days + 1) * 1440;
    addEntity(w, 'ambition', {
      ...{ person: dreamer!.id, ambition: 'trade', skill: 'herbalism', since, done: 0 },
      line: w.begunEvent,
    });
    step(w, sim, TICKS_PER_HOUR);
    const [asked] = lines(w, 'dream.asked');
    expect(asked!.causes).toContain(w.begunEvent);
    const ask = asks(w).find((x) => x['source'] === 'dream')!;
    expect(ask['good']).toBe('herbs');
    expect(willWork(ctx, dreamer!, ask)).toBe(true);
    expect(willWork(ctx, mate!, ask)).toBe(true);
    expect(willWork(ctx, other!, ask)).toBe(false);
    submitCommand(w, { tick: w.tick + 1, kind: 'passAsk', data: { ask: ask.id } });
    step(w, sim, TICKS_PER_HOUR);
    const [passed] = lines(w, 'ask.passed');
    expect(passed!.causes).toContain(asked!.id);
    const sour = (w.entities['memory'] ?? []).filter(
      (m) => m['memory'] === content.asks.dreams.unbacked,
    );
    expect(sour.map((m) => [m['person'], m['line']])).toEqual([[dreamer!.id, passed!.id]]);
    // A house dream taken up and all set apart is backed, and the timber laid out again.
    addEntity(w, 'ambition', {
      ...{ person: mate!.id, ambition: 'house', skill: '', since, done: 0 },
      line: w.begunEvent,
    });
    step(w, sim, TICKS_PER_HOUR);
    const house = asks(w).find((x) => x['source'] === 'dream' && x['good'] === 'logs')!;
    submitCommand(w, { tick: w.tick + 1, kind: 'takeAsk', data: { ask: house.id, level: 1 } });
    step(w, sim, 2);
    Object.assign(house, { got: house['count'], held: `logs=${house['count'] as number}` });
    step(w, sim, TICKS_PER_HOUR);
    const done = lines(w, 'ask.done').at(-1)!;
    expect(done.causes).toContain(house['line']);
    const backed = (w.entities['memory'] ?? []).find(
      (m) => m['memory'] === content.asks.dreams.backed,
    );
    expect(backed?.['person']).toBe(mate!.id);
    expect(itemsOf(w).some((i) => i['made'] === done.id && i['kind'] === 'logs')).toBe(true);
  });
});
