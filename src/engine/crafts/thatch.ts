// The thatcher (6B Bundle 3, P6.11, V-041; amends V-056): the Thatching row of the Priorities
// sheet, building's skill. Nobody is told to roof a house. While a built house or room has no
// roof, or its thatch is worn (build/roofs.ts), a free able person takes it up: cuts its bundles
// one by one, reed on a marsh tile or straw a reaped field left, the nearest first,
// then lays them from beside the house's door. Taking it up and the finished roof are lines; a
// house no thatch can be cut for says so once.
import type { EngineContent, EntityRow } from '../core/index.ts';
import {
  bundlesFor,
  greenOf,
  roofName,
  roofsWanted,
  takeStraw,
  thatchSpots,
} from '../build/index.ts';
import { fieldsOf, strawLeft, wornThatch } from '../build/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able, declineIfUnable, goBeside, outranked, people, practise } from '../band/index.ts';
import { priorityLine, same, scaled, skillOf, spotOf, walkTo, worked } from '../band/index.ts';

const JOB = 'thatch';

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '', bundles: 0 });
  return false;
};

const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === content.buildings.roofs.job)?.skill ?? '';

/** Minutes of thatching work at `p`'s building level. */
const minutesFor = (ctx: SystemContext, p: EntityRow, minutes: number): number => {
  const k = ctx.content.buildings.roofs.skilled;
  return Math.max(
    1,
    Math.ceil((minutes * 2 * k) / (k + skillOf(ctx.world, p, skillName(ctx.content)))),
  );
};

const doorOf = (ctx: SystemContext, h: EntityRow) => {
  const w = ctx.world.map.width;
  const door = h['door'] as number;
  return { x: door % w, y: Math.floor(door / w), z: 0 };
};

/** The house row `p` would roof: the first built (oldest) wanting one nobody else is on, so the
 * straw goes to the house that has waited longest. */
function chooseRoof(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const on = new Set(
    people(world)
      .filter((q) => q.id !== p.id && q['job'] === JOB)
      .map((q) => q['plan'] as number),
  );
  return roofsWanted(world, content).find((h) => !on.has(h.id));
}

/** Whether reed can be cut, or the fields in reach hold the whole roof's straw beyond what
 * other thatchers still have to cut for theirs. */
function enoughThatch(ctx: SystemContext, p: EntityRow, h: EntityRow): boolean {
  const { world, content } = ctx;
  const spots = thatchSpots(world, content, greenOf(world));
  if (spots.some((s) => !s.field)) return true;
  const houses = world.entities['house'] ?? [];
  const promised = people(world)
    .filter((q) => q.id !== p.id && q['job'] === JOB)
    .reduce((n, q) => {
      const r = houses.find((o) => o.id === q['plan']);
      return n + (r ? Math.max(0, bundlesFor(content, r) - (q['bundles'] as number)) : 0);
    }, 0);
  const straw = spots.reduce((n, s) => n + strawLeft(s.field!), 0);
  return straw - promised >= bundlesFor(content, h) - ((p['bundles'] as number) || 0);
}

/** Says once for a house that no thatch can be cut for it. */
function sayNoThatch(ctx: SystemContext, h: EntityRow): void {
  if (h['noThatch']) return;
  h['noThatch'] = ctx.emit('build.noThatch', {
    causes: [h['built'] as number].filter((l) => l > 0),
    data: { size: roofName(ctx.world, ctx.content, h) },
  });
}

/** The line taking up thatching house row `h`, citing the house built (or its last roof). */
function tookLine(ctx: SystemContext, p: EntityRow, h: EntityRow): number {
  const { world, content } = ctx;
  const worn = wornThatch(world, content, h);
  return ctx.emit('work.tookUpThatching', {
    causes: [
      ...[worn ? (h['roofLine'] as number) : (h['built'] as number)],
      priorityLine(world, p.id, JOB) ?? 0,
    ].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      size: roofName(world, content, h),
      why: worn ? 'its thatch is worn and lets the warmth out' : 'it has no roof yet',
    },
  });
}

/** Takes up thatching if a house wants a roof, thatch can be cut, and nobody free who puts
 * Thatching higher could take it instead. */
export function takeUpThatching(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (!roofsWanted(world, content).length) return false;
  if (!able(content, p, JOB)) {
    declineIfUnable(ctx, p, JOB);
    return false;
  }
  if (outranked(ctx, p, JOB, (q) => chooseRoof(ctx, q) !== undefined)) return false;
  const h = chooseRoof(ctx, p);
  if (!h) return false;
  if (!enoughThatch(ctx, p, h)) {
    sayNoThatch(ctx, h);
    return false;
  }
  // Coming back to a roof they had begun is the same work: no new line.
  const again = h['thatcher'] === p.id;
  p['took'] = again ? (h['thatchTook'] as number) : tookLine(ctx, p, h);
  if (!again) Object.assign(h, { thatcher: p.id, thatchTook: p['took'], thatchWith: '' });
  Object.assign(p, {
    job: JOB,
    plan: h.id,
    target: -1,
    work: 0,
    make: 'cut',
    // Bundles cut before other work called them away are kept for this roof.
    bundles: (p['bundles'] as number) || 0,
  });
  return thatching(ctx, p);
}

/** One minute of cutting: walk to the nearest reed or straw, cut a bundle there. */
function cut(ctx: SystemContext, p: EntityRow, h: EntityRow): boolean {
  const { world, content } = ctx;
  const spots = thatchSpots(world, content, greenOf(world));
  const target = p['target'] as number;
  const w = world.map.width;
  const spot =
    spots.find((s) => s.at.y * w + s.at.x === target) ??
    spots.find((s) => same(s.at, spotOf(p)) || walkTo(ctx, p, s.at));
  if (!spot) return stop(p);
  const i = spot.at.y * w + spot.at.x;
  if (target !== i)
    Object.assign(p, {
      target: i,
      work: scaled(ctx, p, 'thatch', minutesFor(ctx, p, content.buildings.roofs.thatch.cut)),
    });
  if (!same(spot.at, spotOf(p))) return walkTo(ctx, p, spot.at) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  worked(ctx, p, 'thatch');
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  if (spot.field) takeStraw(fieldsOf(world).find((f) => f.id === spot.field!.id)!);
  const kind = spot.field ? 'straw' : 'reed';
  const was = h['thatchWith'] as string;
  h['thatchWith'] = !was || was === kind ? kind : 'reed and straw';
  Object.assign(p, { bundles: ((p['bundles'] as number) ?? 0) + 1, target: -1 });
  return true;
}

/** One minute of laying from beside the door; the roof is done when the work runs out. */
function lay(ctx: SystemContext, p: EntityRow, h: EntityRow): boolean {
  const { world, content } = ctx;
  const door = doorOf(ctx, h);
  const here = spotOf(p);
  if (!(here.z === 0 && Math.max(Math.abs(here.x - door.x), Math.abs(here.y - door.y)) <= 1))
    return goBeside(ctx, p, door.x, door.y) || stop(p);
  if (p['make'] !== 'lay') {
    const n = p['bundles'] as number;
    Object.assign(p, {
      make: 'lay',
      work: minutesFor(ctx, p, content.buildings.roofs.thatch.lay) * n,
    });
  }
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const line = ctx.emit('build.roofed', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      size: roofName(world, content, h),
      // Bundles cut for an earlier roof were carried here: none were cut for this one.
      what: (h['thatchWith'] as string) || 'bundles cut earlier',
    },
  });
  Object.assign(h, { roof: 'thatch', roofed: world.tick, roofLine: line, noThatch: 0 });
  Object.assign(h, { thatcher: 0, thatchTook: 0 });
  stop(p);
  return true;
}

/** One minute of thatching: cut until the roof's bundles are held, then lay them. */
export function thatching(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const h = (world.entities['house'] ?? []).find((r) => r.id === p['plan']);
  if (!h || !roofsWanted(world, content).includes(h)) return stop(p);
  if ((p['bundles'] as number) < bundlesFor(content, h)) return cut(ctx, p, h);
  return lay(ctx, p, h);
}
