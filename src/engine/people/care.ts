// The danger rung (P5.6, V-114): before eating, sleeping or work. Nobody is sent to a hurt
// person. Someone lying hurt calls out; whoever is awake and hears them (within `care.hear`
// tiles on the same level) drops what they are doing, binds the wound roughly and carries them
// to a free sickroom bed, else their own bed or bedroll. Someone not found by `care.missing`
// hours after work is looked for. A bleeding wound brings the free person who puts Healing
// highest (woken if asleep) to bind it, and a hungry one someone to bring food (feed.ts). A carried person (or a body, burial.ts) moves with
// whoever carries them.
import { clockAt, type EntityRow, type WorldState } from '../core/index.ts';
import { bedOwnedBy, houseAt, piecesOf } from '../build/index.ts';
import { itemsOf } from '../goods/index.ts';
import {
  bedWords,
  bodiesOf,
  bodyOf,
  isDown,
  openWounds,
  pronouns,
  severityOf,
  stopFor,
  whereWords,
  woundName,
  worstOf,
} from '../health/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { feeding, seekFeeders } from './feed.ts';
import { predatorRung } from './flee.ts';
import { sew } from './surgery.ts';
import { worked } from './tools.ts';
import { practise } from './learn.ts';
import { able, levelOf } from './priority.ts';
import { people, same, skillOf, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

/** Care jobs that come before anything else. */
export const CARE_JOBS = ['carry', 'bind', 'bury', 'feed'];

const far = (a: Spot, b: Spot): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) + Math.abs(a.z - b.z) * 100;

const near = (a: Spot, b: Spot): boolean => a.z === b.z && far(a, b) <= 1;

const personOf = (world: WorldState, id: number): EntityRow | undefined =>
  people(world).find((p) => p.id === id);

/** Free to answer a call: alive, standing, not on care work already, not them. */
const free = (world: WorldState, q: EntityRow, p: EntityRow): boolean =>
  q.id !== p.id &&
  q['status'] === 'alive' &&
  !isDown(world, q.id) &&
  !CARE_JOBS.includes(q['job'] as string);

/** Sets `q` to a care job for `p`, dropping what they carried and were working at. */
function answer(ctx: SystemContext, q: EntityRow, job: string, p: EntityRow, task = ''): void {
  stopFor(ctx, q, false);
  Object.assign(q, { job, target: p.id, task, work: -1, doing: 'work', path: [] });
}

/** Wounds a healer binds at once, day or night: deep or grave ones not yet healer-bound. */
const unbound = (ctx: SystemContext, person: number): EntityRow[] =>
  openWounds(ctx.world, person).filter(
    (w) => (w['bound'] as number) < 2 && severityOf(ctx.content, w).bleed > 0,
  );

/** Where a hurt person is laid: a free sickroom bed, else their own bed, else their bedroll; one
 * someone carrying them can reach. */
function bedFor(
  ctx: SystemContext,
  p: EntityRow,
): { id: number; roll: number; at: Spot } | undefined {
  const { world, content } = ctx;
  const taken = new Set(
    bodiesOf(world)
      .filter((b) => b['person'] !== p.id && b['bed'])
      .map((b) => b['bed']),
  );
  const sick = piecesOf(world, 'bed').filter(
    (b) => b['z'] === 0 && !!houseAt(world, b['x'] as number, b['y'] as number)?.['sick'],
  );
  const own = bedOwnedBy(world, p.id);
  const roll = itemsOf(world).find(
    (i) => i['owner'] === p.id && i['kind'] === content.life.cart.bedroll && i['state'] === 'laid',
  );
  const from = spotOf(p);
  for (const [b, isRoll] of [...sick.map((b) => [b, 0] as const), [own, 0], [roll, 1]] as const) {
    if (!b || taken.has(b.id) || !canReach(content, world.map, from, spotOf(b))) continue;
    return { id: b.id, roll: isRoll, at: spotOf(b) };
  }
  return undefined;
}

/** Each minute, before anyone's choice: the carried move with their carrier; the unfound get a
 * finder who hears them (or, `care.missing` hours after work, anyone who goes to look); a
 * bleeding wound gets a healer. */
export function careMinute(ctx: SystemContext): void {
  const { world } = ctx;
  const bodies = bodiesOf(world);
  if (!bodies.length) return;
  for (const b of bodies) {
    const p = personOf(world, b['person'] as number);
    if (!p || p['status'] === 'buried') continue;
    if (b['carrier']) {
      const c = personOf(world, b['carrier'] as number);
      if (c?.['status'] === 'alive' && c['target'] === p.id && c['doing'] === 'work')
        Object.assign(p, spotOf(c));
      else b['carrier'] = 0;
    }
    if (p['status'] !== 'alive') continue;
    // A finder or healer hurt, dead or called away on the way leaves them to someone else.
    if (b['finder'] && !b['found'] && !on(world, b['finder'] as number, 'carry', p.id))
      b['finder'] = 0;
    if (b['healer'] && !on(world, b['healer'] as number, 'bind', p.id)) b['healer'] = 0;
    if (b['down'] && !b['found'] && !b['finder'] && !b['carrier']) seekFinder(ctx, p, b);
    else if (b['down'] && b['found'] && !b['bed'] && !b['carrier'] && ctx.world.tick % 60 === 0)
      seekCarrier(ctx, p);
    if (!b['healer'] && unbound(ctx, p.id).length) seekHealer(ctx, p, b);
  }
  seekFeeders(
    ctx,
    (q, p) => free(world, q, p),
    (q, p) => answer(ctx, q, 'feed', p),
  );
}

/** Whether `id` is alive and on `job` for `target`. */
const on = (world: WorldState, id: number, job: string, target: number): boolean => {
  const q = personOf(world, id);
  return q?.['status'] === 'alive' && q['job'] === job && q['target'] === target;
};

/** Found but left lying for want of a bed: each hour, once a bed is free, the nearest awake
 * person comes to carry them to it. */
function seekCarrier(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const bed = bedFor(ctx, p);
  const at = spotOf(p);
  if (!bed || same(at, bed.at)) return;
  const q = people(world)
    .filter((r) => free(world, r, p) && r['doing'] !== 'sleep')
    .filter((r) => canReach(content, world.map, spotOf(r), at))
    .sort((a, c) => far(spotOf(a), at) - far(spotOf(c), at) || a.id - c.id)[0];
  if (!q) return;
  answer(ctx, q, 'carry', p, 'fetch');
  walkTo(ctx, q, at);
}

/** The nearest awake person who hears `p`, or after work anyone, comes to find them. */
function seekFinder(ctx: SystemContext, p: EntityRow, b: EntityRow): void {
  const { world, content } = ctx;
  const at = spotOf(p);
  const awake = people(world).filter((q) => free(world, q, p) && q['doing'] !== 'sleep');
  const hearing = awake.filter(
    (q) => q['z'] === p['z'] && far(spotOf(q), at) <= content.health.care.hear,
  );
  const late =
    clockAt(world.tick, content.calendar).hour ===
    content.work.hours.to + content.health.care.missing;
  const pool = hearing.length ? hearing : late && !b['missed'] ? awake : [];
  const q = [...pool]
    .filter((r) => canReach(content, world.map, spotOf(r), at))
    .sort((a, c) => far(spotOf(a), at) - far(spotOf(c), at) || a.id - c.id)[0];
  if (!q) return;
  if (!hearing.length) {
    b['missed'] = 1;
    const w = worstOf(content, openWounds(world, p.id));
    ctx.emit('health.missed', {
      causes: [w?.['line'] as number].filter((l) => l > 0),
      actors: [p.id, q.id],
      data: {
        name: p['name'] as string,
        where: (w?.['where'] as string) || 'work',
        finder: q['name'] as string,
      },
    });
  }
  answer(ctx, q, 'carry', p, 'find');
  b['finder'] = q.id;
  walkTo(ctx, q, at);
}

/** The free, able person who puts Healing highest (then the most skilled, then the nearest)
 * comes to bind a bleeding wound, woken if asleep. */
function seekHealer(ctx: SystemContext, p: EntityRow, b: EntityRow): void {
  const { world, content } = ctx;
  const job = content.health.care.job;
  const skill = content.jobs.find((j) => j.id === job)?.skill ?? '';
  const at = spotOf(p);
  const h = people(world)
    .filter((q) => free(world, q, p) && able(content, q, job))
    .filter((q) => canReach(content, world.map, spotOf(q), at))
    .sort(
      (a, c) =>
        levelOf(world, content, a.id, job) - levelOf(world, content, c.id, job) ||
        skillOf(world, c, skill) - skillOf(world, a, skill) ||
        far(spotOf(a), at) - far(spotOf(c), at) ||
        a.id - c.id,
    )[0];
  if (!h) return;
  answer(ctx, h, 'bind', p);
  b['healer'] = h.id;
}

/** The danger rung for `p` this minute; true when it took the minute. */
export function danger(ctx: SystemContext, p: EntityRow): boolean {
  const { world } = ctx;
  const b = bodyOf(world, p.id);
  if (b?.['down']) {
    Object.assign(p, { doing: 'hurt', path: [], stride: 0 });
    return true;
  }
  // P5.4a: a predator in sight comes before everything, even carrying the hurt: stand or flee.
  if (predatorRung(ctx, p)) return true;
  if (p['job'] === 'carry') return carrying(ctx, p);
  if (p['job'] === 'bind') return binding(ctx, p);
  if (p['job'] === 'feed') return feeding(ctx, p);
  // Someone up and about waits where they are for the healer coming to bind them.
  if (b?.['healer'] && personOf(world, b['healer'] as number)?.['job'] === 'bind') {
    p['path'] = [];
    return true;
  }
  return false;
}

/** Ends a care job. */
function done(p: EntityRow): false {
  Object.assign(p, { job: '', target: -1, task: '', work: 0 });
  return false;
}

/** Finding, then carrying to bed. */
function carrying(ctx: SystemContext, q: EntityRow): boolean {
  const { world, content } = ctx;
  const p = personOf(world, q['target'] as number);
  const b = p && bodyOf(world, p.id);
  if (!p || !b || p['status'] !== 'alive' || !b['down']) {
    if (b && b['carrier'] === q.id) b['carrier'] = 0;
    return done(q);
  }
  if ((q['path'] as number[]).length) return true;
  if (q['task'] === 'find' || q['task'] === 'fetch') {
    if (!near(spotOf(q), spotOf(p)))
      return walkTo(ctx, q, spotOf(p)) || (q['task'] === 'find' && (b['finder'] = 0), done(q));
    if (q['task'] === 'find') found(ctx, q, p, b);
    else lift(ctx, q, p, b);
    return true;
  }
  // Carrying: laid on the bed when they get there.
  const bed = bedFor(ctx, p);
  if (!bed) return done(q);
  if (!same(spotOf(q), bed.at)) return walkTo(ctx, q, bed.at) || done(q);
  Object.assign(p, bed.at);
  Object.assign(b, { carrier: 0, bed: bed.id, roll: bed.roll });
  const line = ctx.emit('health.carried', {
    causes: [
      openWounds(world, p.id)
        .map((w) => w['care'] as number)
        .sort((x, y) => y - x)[0] ?? 0,
    ].filter((l) => l > 0),
    actors: [q.id, p.id],
    data: {
      finder: q['name'] as string,
      name: p['name'] as string,
      bed: bedWords(world, content, p),
    },
  });
  for (const w of openWounds(world, p.id)) w['care'] = line;
  return done(q);
}

/** The finder binds the wounds as best they can (a rough binding stops slow bleeding), then
 * picks them up if there is a bed to carry them to. */
function found(ctx: SystemContext, q: EntityRow, p: EntityRow, b: EntityRow): void {
  const { world, content } = ctx;
  const wounds = openWounds(world, p.id);
  for (const w of wounds) {
    if ((w['bound'] as number) > 0) continue;
    w['bound'] = 1;
    if (w['bleed'] === 1 && !w['mortal']) w['bleed'] = 0;
  }
  const worst = worstOf(content, wounds);
  const line = ctx.emit('health.found', {
    causes: [worst?.['line'] as number].filter((l) => l > 0),
    actors: [q.id, p.id],
    data: {
      finder: q['name'] as string,
      name: p['name'] as string,
      where: whereWords(world, content, p),
      they: pronouns(q).they,
    },
  });
  for (const w of wounds) w['care'] = line;
  b['found'] = line;
  lift(ctx, q, p, b);
}

/** Picks them up if there is a bed to carry them to, else leaves them lying there. */
function lift(ctx: SystemContext, q: EntityRow, p: EntityRow, b: EntityRow): void {
  const bed = bedFor(ctx, p);
  if (!bed || same(spotOf(p), bed.at)) {
    if (bed) Object.assign(b, { bed: bed.id, roll: bed.roll });
    done(q);
    return;
  }
  q['task'] = 'carry';
  b['carrier'] = q.id;
  if (!walkTo(ctx, q, bed.at)) {
    b['carrier'] = 0;
    done(q);
  }
}

/** A healer on the way to bind a bleeding wound, then binding it. */
function binding(ctx: SystemContext, h: EntityRow): boolean {
  const { world, content } = ctx;
  const p = personOf(world, h['target'] as number);
  const b = p && bodyOf(world, p.id);
  const wounds = p && p['status'] === 'alive' ? unbound(ctx, p.id) : [];
  if (!p || !b || !wounds.length) {
    if (b && b['healer'] === h.id) b['healer'] = 0;
    return done(h);
  }
  const at = spotOf(p);
  if (b['carrier'] || !near(spotOf(h), at)) {
    const path = h['path'] as number[];
    if (!path.length && !walkTo(ctx, h, at)) {
      b['healer'] = 0;
      return done(h);
    }
    return true;
  }
  h['path'] = [];
  const care = content.health.care;
  const skill = content.jobs.find((j) => j.id === care.job)?.skill ?? '';
  if ((h['work'] as number) < 0)
    h['work'] = Math.ceil(
      (care.bind * 2 * care.skilled) / (care.skilled + skillOf(world, h, skill)),
    );
  h['work'] = (h['work'] as number) - 1;
  practise(ctx, h, skill, 0);
  worked(ctx, h, care.job);
  if ((h['work'] as number) > 0) return true;
  bindWounds(ctx, h, p, wounds);
  b['healer'] = 0;
  return done(h) || true;
}

/** A healer's binding: each wound bleeds a step less at once (another each hour, health), save
 * one that bleeds out whatever is done. One line, naming the worst. */
export function bindWounds(
  ctx: SystemContext,
  h: EntityRow,
  p: EntityRow,
  wounds: readonly EntityRow[],
): void {
  const { world, content } = ctx;
  const bled = wounds.some((w) => (w['bleed'] as number) > 0);
  for (const w of wounds) {
    Object.assign(w, { bound: 2, healer: h.id, dressed: world.tick });
    if (!w['mortal']) w['bleed'] = Math.max(0, (w['bleed'] as number) - 1);
  }
  const worst = worstOf(content, wounds)!;
  const stopped = worst['mortal']
    ? ' The bleeding would not stop.'
    : wounds.some((w) => (w['bleed'] as number) > 0)
      ? ' The bleeding slowed.'
      : bled
        ? ' The bleeding stopped.'
        : '';
  const line = ctx.emit('health.bound', {
    causes: [worst['line'] as number, worst['care'] as number].filter((l) => l > 0),
    actors: [h.id, p.id],
    data: {
      healer: h['name'] as string,
      name: p['name'] as string,
      wound: woundName(content, worst),
      stopped,
    },
  });
  for (const w of wounds) w['care'] = line;
  sew(ctx, h, p, wounds);
}
