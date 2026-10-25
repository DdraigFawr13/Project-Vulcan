// Strangers (P5.9, V-117, V-118, V-028). Each month there is a chance someone comes from one of
// the valley's neighbours, drawn by food in the store, a free bed and the colony's name, a third
// as often in winter; the first always comes in the first autumn. They come with a reason from
// that place's record (region/record.ts) and walk in from its side of the map to the green, where
// the band speaks for or against them (verdict.ts). Nobody is placed or admitted by the player
// (V-041): the Strangers law only settles a split. All numbers are content (strangers.json).
import { clockAt, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import { bedSpot, houseAt, mainOf, piecesOf } from '../build/index.ts';
import { isWinter } from '../law/index.ts';
import { neighboursOf, type Neighbour } from '../region/index.ts';
import type { RngStream } from '../core/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { bringKnown, drawStranger, knownOf } from './band.ts';
import { addPerson } from './row.ts';
import { drawSmithing } from './smithing.ts';
import { stepAlong } from './walk.ts';
import { foodDays } from './welcome.ts';
import { decide, list, namesOf } from './verdict.ts';
import { edgeSpot, toGreen } from './edge.ts';

const people = (world: WorldState): EntityRow[] => world.entities['person'] ?? [];
const alive = (world: WorldState) => people(world).filter((p) => p['status'] === 'alive');
const strangersOf = (world: WorldState) => people(world).filter((p) => p['status'] === 'stranger');

/** Free beds where a newcomer would sleep (the band's houses, not anyone's home), and whether a
 * bedroll would find floor there. */
export function freeBeds(world: WorldState, content: EngineContent) {
  const beds = piecesOf(world, 'bed').filter((b) => {
    const h = houseAt(world, b['x'] as number, b['y'] as number);
    return !b['owner'] && h?.['state'] === 'built' && !h['sick'] && !mainOf(world, h)['owner'];
  }).length;
  // As someone with no home (-1): floor anywhere but in another's home.
  return { beds, floor: !!bedSpot(world, content, undefined, [], -1) };
}

/** This month's chance of a stranger, in percent, with what goes into it. */
export function oddsOf(ctx: SystemContext) {
  const { world, content, state } = ctx;
  const d = content.strangers.draw;
  const mouths = alive(world).length;
  const { food, days } = foodDays(world, content, mouths);
  const step = d.food.find((f) => days >= f.days) ?? d.food.at(-1)!;
  const { beds, floor } = freeBeds(world, content);
  let pct = (d.base * step.rate) / 100;
  if (!beds && !floor) pct = (pct * d.noBed) / 100;
  pct += d.name * (state['stayed'] ?? 0);
  if (isWinter(world, content)) pct = (pct * d.winter) / 100;
  return { percent: Math.floor(pct), food, days, mouths, beds, floor };
}

const COUNT = ['nobody', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Someone comes from a neighbour: one or a couple, drawn as the band was, walking in. */
function come(ctx: SystemContext, rng: RngStream, near: readonly Neighbour[]): void {
  const { world, content } = ctx;
  const s = content.strangers;
  const odds = oddsOf(ctx);
  const n = rng.weighted(near.map((h) => [h, Math.max(1, Math.floor(60 / h.days))] as const));
  const reason = n.reasons.length ? rng.pick(n.reasons) : { kind: 'wander', line: '' };
  const settled = (world.entities['colony'] ?? [])[0]?.['settled'] as number | undefined;
  const from = [settled || world.begunEvent];
  const record = reason.line
    ? ctx.emit('region.record', { causes: from, data: { text: `“${reason.line}”` } })
    : 0;
  const spare = odds.days >= (s.draw.food[1]?.days ?? 0);
  const where = world.entities['house']?.some((h) => h['hall']) ? 'The hall' : 'The first house';
  const drawn = ctx.emit('people.drawn', {
    causes: from,
    data: {
      spare: spare ? 'food to spare' : 'little food to spare',
      food: odds.food,
      days: odds.days,
      mouths: COUNT[odds.mouths] ?? String(odds.mouths),
      beds: odds.beds
        ? ` ${where} has ${COUNT[odds.beds] ?? odds.beds} free bed${odds.beds > 1 ? 's' : ''}.`
        : odds.floor
          ? ` ${where} has floor for a bedroll.`
          : '',
    },
  });
  const spot = edgeSpot(world, content, n.dir);
  if (!spot) return;
  const home = { name: n.name, culture: n.culture, days: n.days, dir: n.dir };
  const taken = people(world).map((p) => p['name'] as string);
  const a = drawStranger(rng, content, home, taken);
  const couple = rng.int(100) < s.couple;
  const group = couple
    ? [a, drawStranger(rng, content, home, [...taken, a.name], a.sex === 'f' ? 'm' : 'f')]
    : [a];
  const known = knownOf(content, n.kind, n.culture);
  if (known) for (const p of group) bringKnown(rng, content, p, known.skill);
  const brings = rng.int(100) < s.animal ? rng.pick(s.animals) : '';
  const smith = drawSmithing(rng, content, group);
  const year = clockAt(world.tick, content.calendar).year;
  const ids = group.map((p, k) =>
    addPerson(
      world,
      content,
      p,
      { ...spot, status: 'stranger', arrived: drawn, born: year - p.age, rest: 0 },
      smith[k]!,
      {
        ...{ reason: reason.kind, sent: record || drawn, brings: k === 0 ? brings : '' },
        ...{ known: known?.skill ?? '', knownWhy: known?.key ?? '' },
      },
    ),
  );
  const rows = ids.map((id) => people(world).find((p) => p.id === id)!);
  if (rows.length > 1) [rows[0]!['partner'], rows[1]!['partner']] = [ids[1]!, ids[0]!];
  for (const p of rows) toGreen(ctx, p);
}

/** At the hour, on the month's first day (the first stranger's own day in the first autumn). */
function drawMonth(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const d = content.strangers.draw;
  const c = clockAt(world.tick, content.calendar);
  if (c.hour !== d.hour || c.minute !== 0) return;
  // One at a time: nobody comes while a stranger is on their way or waiting.
  if (strangersOf(world).some((p) => (p['waits'] as number) >= 0)) return;
  const first = !state['first'];
  if (first) {
    const month = content.calendar.monthNames.indexOf(d.first.month);
    if (c.month !== month || c.day !== d.first.day) return;
  } else if (c.day !== 1) return;
  const near = neighboursOf(world.seed, content);
  if (!near.length) return;
  const rng = ctx.rng();
  if (!first && rng.int(100) >= oddsOf(ctx).percent) return;
  state['first'] = 1;
  come(ctx, rng, near);
}

/** A stranger at the green (the first of a couple speaks for both): one line, then they wait. */
function arrive(ctx: SystemContext, lead: EntityRow, group: EntityRow[]): void {
  const { world, content, state } = ctx;
  const kind = content.strangers.kinds.find((k) => k.id === lead['reason']);
  const odds = oddsOf(ctx);
  const drew = [
    odds.days >= (content.strangers.draw.food[1]?.days ?? 0) ? 'food' : '',
    odds.beds || odds.floor ? 'a bed' : '',
    state['stayed'] ? 'others who stayed' : '',
  ].filter(Boolean);
  const brings = lead['brings'] as string;
  const kd = content.flock.kinds.find((k) => k.species === brings);
  const line = ctx.emit('people.strangerCame', {
    causes: [lead['sent'] as number, lead['arrived'] as number].filter(
      (l, k, a) => l > 0 && a.indexOf(l) === k,
    ),
    actors: group.map((p) => p.id),
    data: {
      names: namesOf(group),
      place: lead['home'] as string,
      dir: lead['homeDir'] as string,
      bundle: kd ? `, leading a ${kd.femaleName}` : ', carrying a bundle',
      words: kind?.words ?? 'has nothing to keep them',
      draw: drew.length ? list(drew) : 'land to be had',
    },
  });
  for (const p of group)
    Object.assign(p, { stranger: line, arrived: line, waits: world.tick + content.strangers.wait });
}

/** One minute for each stranger: walking, arriving, the band's word, walking away. */
function strangersMinute(ctx: SystemContext): void {
  const { world } = ctx;
  for (const p of strangersOf(world)) {
    // A partner settled with the first of a couple this minute.
    if (p['status'] !== 'stranger') continue;
    stepAlong(ctx, p);
    if ((p['path'] as number[]).length) continue;
    const waits = p['waits'] as number;
    // Gone back the way they came, off the map.
    if (waits < 0) {
      p['status'] = 'gone';
      continue;
    }
    const mate = people(world).find((q) => q.id === p['partner']);
    // A couple stands together: the first of the two speaks for both, once both are there.
    if (mate && mate.id < p.id && mate['status'] === 'stranger') continue;
    const group = mate?.['status'] === 'stranger' ? [p, mate] : [p];
    if (group.some((q) => (q['path'] as number[]).length)) continue;
    if (!p['stranger']) arrive(ctx, p, group);
    else if (world.tick >= waits) decide(ctx, p, group);
  }
}

export const strangersSystem: System = {
  id: 'strangers',
  every: 'minute',
  stream: 'strangers',
  emits: [
    ...['region.record', 'people.drawn', 'people.strangerCame', 'people.strangerStays'],
    ...['people.strangerTurnedAway', 'people.strangerFed', 'people.broughtAnimal', 'law.answered'],
  ],
  // `first` 1 once the first stranger came; `stayed` how many stayed, the colony's name; `last`
  // the line of the band's last word on a stranger.
  initialState: { first: 0, stayed: 0, last: 0 },
  run(ctx) {
    drawMonth(ctx);
    strangersMinute(ctx);
  },
};
