// One simulation tick for the colony: regrowth, the hearth, colonists' needs, choices and
// actions, then stock conditions. Colonists act in id order; every random draw comes from a
// named stream.

import { emit, type EventSink } from '../core/events.ts';
import { streamFor } from '../core/rng.ts';
import { isNight } from '../core/time.ts';
import {
  Feature,
  type Colonist,
  type Content,
  type GatherJobDef,
  type NeedId,
  type WorldState,
} from '../core/types.ts';
import { findNearest, findPath, tileIndex, walkable } from '../world/path.ts';

const NEEDS: readonly NeedId[] = ['food', 'rest', 'company'];
/** How far a wanderer strays, in tiles. */
const WANDER_RADIUS = 5;

interface Ctx {
  world: WorldState;
  content: Content;
  sink: EventSink;
}

export function tickColony(world: WorldState, content: Content, sink: EventSink): void {
  const ctx: Ctx = { world, content, sink };
  regrow(ctx);
  burnHearth(ctx);
  for (const colonist of world.colonists) {
    updateNeeds(ctx, colonist);
    interrupt(ctx, colonist);
    if (colonist.task.kind === 'idle') choose(ctx, colonist);
    act(ctx, colonist);
  }
  checkStock(ctx);
  world.tick += 1;
}

// ---- World upkeep ----

function regrow({ world, content }: Ctx): void {
  const { map } = world;
  for (let i = 0; i < map.regrowAt.length; i += 1) {
    if (map.regrowAt[i] === 0 || map.regrowAt[i]! > world.tick) continue;
    map.amount[i] = Math.min(content.tuning.bushMax, map.amount[i]! + 1);
    map.regrowAt[i] =
      map.amount[i]! < content.tuning.bushMax ? world.tick + content.tuning.bushRegrowTicks : 0;
  }
}

function burnHearth({ world, content, sink }: Ctx): void {
  const { colony } = world;
  if (colony.hearthFuel <= 0) return;
  colony.hearthFuel -= 1;
  if (colony.hearthFuel === 0) {
    colony.hearthOutEvent = emit(world, content, sink, 'hearth.out', { place: colony.hearth });
  }
}

function checkStock({ world, content, sink }: Ctx): void {
  const { colony } = world;
  for (const job of content.jobs) {
    const amount = colony.stock[job.resource];
    const open = colony.stockLowEvent[job.resource];
    if (open === undefined && amount < job.stockTarget / 2) {
      colony.stockLowEvent[job.resource] = emit(world, content, sink, 'stock.low', {
        place: colony.store,
        data: { resource: job.resource, amount },
      });
    } else if (open !== undefined && amount >= job.stockTarget) {
      delete colony.stockLowEvent[job.resource];
      emit(world, content, sink, 'stock.recovered', {
        place: colony.store,
        causes: [open],
        data: { resource: job.resource },
      });
    }
  }
}

// ---- Needs ----

function updateNeeds({ world, content, sink }: Ctx, c: Colonist): void {
  const t = content.tuning;
  const sleeping = c.task.kind === 'sleep' && c.task.phase === 'sleep';
  c.needs.food = Math.max(0, c.needs.food - t.decayPerTick.food);
  c.needs.company = Math.max(0, c.needs.company - t.decayPerTick.company);
  if (sleeping) {
    const gain = isWarm(world, content, c) ? t.restPerTickWarm : t.restPerTickCold;
    c.needs.rest = Math.min(t.needMax, c.needs.rest + gain);
  } else {
    c.needs.rest = Math.max(0, c.needs.rest - t.decayPerTick.rest);
  }
  for (const need of NEEDS) {
    const value = c.needs[need];
    const open = c.openNeedEvents[need];
    const words = content.needWords[need];
    if (value >= t.lowAt[need]) {
      delete c.openNeedEvents[need];
    } else if (open === undefined) {
      const id = emit(world, content, sink, 'need.low', {
        actors: [c.id],
        place: { x: c.x, y: c.y },
        data: { need, feeling: words.low },
      });
      c.openNeedEvents[need] = { id, critical: false };
    } else if (value < t.criticalAt[need] && !open.critical) {
      const id = emit(world, content, sink, 'need.critical', {
        actors: [c.id],
        place: { x: c.x, y: c.y },
        causes: [open.id],
        data: { need, feeling: words.critical },
      });
      c.openNeedEvents[need] = { id, critical: true };
    }
  }
}

function isWarm(world: WorldState, content: Content, c: Colonist): boolean {
  const { hearth, hearthFuel } = world.colony;
  const r = content.tuning.warmRadius;
  return hearthFuel > 0 && Math.abs(c.x - hearth.x) <= r && Math.abs(c.y - hearth.y) <= r;
}

// ---- Interrupts and choices ----

function interrupt(ctx: Ctx, c: Colonist): void {
  const { world, content, sink } = ctx;
  const t = content.tuning;
  const asleep = c.task.kind === 'sleep' && c.task.phase === 'sleep';
  if (!asleep && c.needs.rest < t.criticalAt.rest) {
    release(ctx, c);
    const slept = emit(world, content, sink, 'collapsed', {
      actors: [c.id],
      place: { x: c.x, y: c.y },
      causes: [c.openNeedEvents.rest?.id],
    });
    c.task = { kind: 'sleep', phase: 'sleep', sleptEvent: slept };
    return;
  }
  // A starving colonist drops what they are doing to eat, unless food is out and they are
  // already foraging (dropping that would leave them nothing to eat).
  const foraging = c.task.kind === 'gather' && c.task.job === 'forage';
  const canEat = world.colony.stock.food > 0 || !foraging;
  const busyWithNeed = c.task.kind === 'eat' || c.task.kind === 'sleep';
  if (!busyWithNeed && canEat && c.needs.food < t.criticalAt.food) {
    release(ctx, c);
    c.path = [];
    c.task = { kind: 'idle' };
  }
}

function choose(ctx: Ctx, c: Colonist): void {
  const { world, content } = ctx;
  const t = content.tuning;
  const night = isNight(world.tick, t);
  if (c.needs.rest < t.lowAt.rest && goSleep(ctx, c)) return;
  if (c.needs.food < t.lowAt.food && goEat(ctx, c)) return;
  if (c.carrying) {
    if (setPath(ctx, c, storeTile(world))) c.task = { kind: 'deliver' };
    return;
  }
  if (night) {
    if (goSleep(ctx, c)) return;
  }
  if (needsStoking(world, content) && startStoke(ctx, c)) return;
  if (startJob(ctx, c)) return;
  if (c.needs.company < t.lowAt.company && startChat(ctx, c)) return;
  wander(ctx, c);
}

function goSleep(ctx: Ctx, c: Colonist): boolean {
  const { world, content } = ctx;
  const { map } = world;
  const { hearth } = world.colony;
  const r = content.tuning.warmRadius - 1;
  const here = tileIndex(map, c.x, c.y);
  const free = (i: number) =>
    map.feature[i] === Feature.None && (map.reservedBy[i] === 0 || map.reservedBy[i] === c.id + 1);
  const path =
    findNearest(map, here, (i) => {
      const x = i % map.width;
      const y = Math.floor(i / map.width);
      return free(i) && Math.abs(x - hearth.x) <= r && Math.abs(y - hearth.y) <= r;
    }) ?? findNearest(map, here, free);
  if (!path) return false;
  claim(ctx, c, path.length ? path[path.length - 1]! : here);
  c.path = path;
  c.task = { kind: 'sleep', phase: 'go', sleptEvent: -1 };
  return true;
}

function goEat(ctx: Ctx, c: Colonist): boolean {
  const { world } = ctx;
  if (world.colony.stock.food > 0) {
    if (!setPath(ctx, c, storeTile(world))) return false;
    c.task = { kind: 'eat', phase: 'go', progress: 0, fromBush: false };
    return true;
  }
  // The store is empty: eat straight from the nearest bush.
  const path = nearestFeature(ctx, c, Feature.Bush);
  if (!path) return false;
  c.task = { kind: 'eat', phase: 'go', progress: 0, fromBush: true };
  return true;
}

function needsStoking(world: WorldState, content: Content): boolean {
  return (
    world.colony.hearthFuel < content.tuning.stokeBelow &&
    world.colony.stock.wood > 0 &&
    !world.colonists.some((other) => other.task.kind === 'stoke')
  );
}

function startStoke(ctx: Ctx, c: Colonist): boolean {
  if (!setPath(ctx, c, storeTile(ctx.world))) return false;
  c.task = { kind: 'stoke', phase: 'fetch' };
  return true;
}

/** Demand for a job's resource: 1 at or below its stock target, falling to 0 at twice it. */
export function jobDemand(world: WorldState, job: GatherJobDef): number {
  const stock = world.colony.stock[job.resource];
  return Math.max(0, Math.min(1, (2 * job.stockTarget - stock) / job.stockTarget));
}

/** Job ids in the order this colonist would take them, best first (score > 0 only). */
export function rankJobs(world: WorldState, content: Content, c: Colonist): GatherJobDef[] {
  const scored = content.jobs
    .map((job, order) => {
      const demand = jobDemand(world, job);
      const liked = c.likes === job.id ? content.tuning.likedJobBonus : 0;
      return { job, order, score: demand > 0 ? job.priority * demand + liked : 0 };
    })
    .filter((entry) => entry.score > 0);
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((entry) => entry.job);
}

function startJob(ctx: Ctx, c: Colonist): boolean {
  for (const job of rankJobs(ctx.world, ctx.content, c)) {
    if (!nearestFeature(ctx, c, job.feature)) continue;
    c.task = { kind: 'gather', job: job.id, phase: 'go', progress: 0 };
    return true;
  }
  return false;
}

function startChat(ctx: Ctx, c: Colonist): boolean {
  const range = ctx.content.tuning.chatRange;
  const partner = ctx.world.colonists.find(
    (other) =>
      other.id !== c.id &&
      (other.task.kind === 'idle' || other.task.kind === 'wander') &&
      Math.abs(other.x - c.x) + Math.abs(other.y - c.y) <= range,
  );
  if (!partner) return false;
  release(ctx, partner);
  partner.path = [];
  c.path = [];
  c.task = { kind: 'chat', partner: partner.id, lead: true, progress: 0 };
  partner.task = { kind: 'chat', partner: c.id, lead: false, progress: 0 };
  return true;
}

function wander(ctx: Ctx, c: Colonist): void {
  const { world } = ctx;
  const { map } = world;
  const rng = streamFor(world, 'colonists.wander');
  const dx = rng.between(-WANDER_RADIUS, WANDER_RADIUS);
  const dy = rng.between(-WANDER_RADIUS, WANDER_RADIUS);
  const x = Math.max(0, Math.min(map.width - 1, c.x + dx));
  const y = Math.max(0, Math.min(map.height - 1, c.y + dy));
  const goal = tileIndex(map, x, y);
  c.task = { kind: 'wander' };
  c.path = walkable(map, goal) ? (findPath(map, tileIndex(map, c.x, c.y), goal) ?? []) : [];
}

// ---- Actions ----

function act(ctx: Ctx, c: Colonist): void {
  if (c.path.length > 0) {
    const next = c.path.shift()!;
    c.x = next % ctx.world.map.width;
    c.y = Math.floor(next / ctx.world.map.width);
    return;
  }
  const task = c.task;
  switch (task.kind) {
    case 'idle':
      return;
    case 'wander':
      c.task = { kind: 'idle' };
      return;
    case 'gather':
      return actGather(ctx, c, task);
    case 'eat':
      return actEat(ctx, c, task);
    case 'sleep':
      return actSleep(ctx, c, task);
    case 'deliver':
      return actDeliver(ctx, c);
    case 'stoke':
      return actStoke(ctx, c, task);
    case 'chat':
      return actChat(ctx, c, task);
  }
}

function actGather(
  ctx: Ctx,
  c: Colonist,
  task: Extract<Colonist['task'], { kind: 'gather' }>,
): void {
  const { world, content } = ctx;
  const { map } = world;
  const job = content.jobs.find((entry) => entry.id === task.job)!;
  const here = tileIndex(map, c.x, c.y);
  if (map.feature[here] !== job.feature || map.amount[here] === 0) {
    release(ctx, c);
    c.task = { kind: 'idle' };
    return;
  }
  task.phase = 'work';
  task.progress += 1;
  if (task.progress < job.workTicks) return;
  takeUnit(ctx, here);
  release(ctx, c);
  c.carrying = { resource: job.resource, amount: 1 };
  if (setPath(ctx, c, storeTile(world))) c.task = { kind: 'deliver' };
  else c.task = { kind: 'idle' };
}

function actDeliver(ctx: Ctx, c: Colonist): void {
  const { world, content, sink } = ctx;
  if (!c.carrying) {
    c.task = { kind: 'idle' };
    return;
  }
  const { resource, amount } = c.carrying;
  world.colony.stock[resource] += amount;
  c.carrying = null;
  c.task = { kind: 'idle' };
  emit(world, content, sink, 'job.done', {
    actors: [c.id],
    place: world.colony.store,
    causes: [world.colony.stockLowEvent[resource]],
    data: { resource, amount },
  });
}

function actEat(ctx: Ctx, c: Colonist, task: Extract<Colonist['task'], { kind: 'eat' }>): void {
  const { world, content, sink } = ctx;
  const t = content.tuning;
  const here = tileIndex(world.map, c.x, c.y);
  task.phase = 'eat';
  task.progress += 1;
  if (task.progress < t.eatTicks) return;
  const cause = c.openNeedEvents.food?.id;
  if (task.fromBush) {
    if (world.map.feature[here] === Feature.Bush && world.map.amount[here]! > 0) {
      takeUnit(ctx, here);
      c.needs.food = Math.min(t.needMax, c.needs.food + t.mealValue);
      emit(world, content, sink, 'ate.at.source', {
        actors: [c.id],
        place: { x: c.x, y: c.y },
        causes: [cause, world.colony.stockLowEvent.food],
      });
    }
  } else if (world.colony.stock.food > 0) {
    world.colony.stock.food -= 1;
    c.needs.food = Math.min(t.needMax, c.needs.food + t.mealValue);
    emit(world, content, sink, 'ate', {
      actors: [c.id],
      place: { x: c.x, y: c.y },
      causes: [cause],
    });
  }
  release(ctx, c);
  c.task = { kind: 'idle' };
}

function actSleep(ctx: Ctx, c: Colonist, task: Extract<Colonist['task'], { kind: 'sleep' }>): void {
  const { world, content, sink } = ctx;
  const t = content.tuning;
  if (task.phase === 'go') {
    task.phase = 'sleep';
    task.sleptEvent = emit(
      world,
      content,
      sink,
      isWarm(world, content, c) ? 'slept' : 'slept.cold',
      {
        actors: [c.id],
        place: { x: c.x, y: c.y },
        causes: [c.openNeedEvents.rest?.id],
      },
    );
    return;
  }
  // Sleepers stay down through the night; by day they get up once rested enough.
  const starving = c.needs.food < t.criticalAt.food && c.needs.rest >= t.lowAt.rest;
  const upForTheDay = !isNight(world.tick, t) && c.needs.rest >= t.lowAt.rest + 400;
  if (!starving && !upForTheDay) return;
  const type = starving ? 'woke.hungry' : c.needs.rest >= t.wakeAt ? 'woke' : 'woke.tired';
  emit(world, content, sink, type, {
    actors: [c.id],
    place: { x: c.x, y: c.y },
    causes: [task.sleptEvent],
  });
  release(ctx, c);
  c.task = { kind: 'idle' };
}

function actStoke(ctx: Ctx, c: Colonist, task: Extract<Colonist['task'], { kind: 'stoke' }>): void {
  const { world, content, sink } = ctx;
  const { colony } = world;
  if (task.phase === 'fetch') {
    if (colony.stock.wood <= 0) {
      c.task = { kind: 'idle' };
      return;
    }
    colony.stock.wood -= 1;
    c.carrying = { resource: 'wood', amount: 1 };
    task.phase = 'go';
    if (!setPath(ctx, c, tileIndex(world.map, colony.hearth.x, colony.hearth.y))) {
      c.task = { kind: 'idle' };
    }
    return;
  }
  const wasOut = colony.hearthFuel === 0;
  colony.hearthFuel += content.tuning.fuelPerWood;
  c.carrying = null;
  c.task = { kind: 'idle' };
  if (wasOut) {
    emit(world, content, sink, 'hearth.relit', {
      actors: [c.id],
      place: colony.hearth,
      causes: [colony.hearthOutEvent ?? undefined],
    });
    colony.hearthOutEvent = null;
  } else {
    emit(world, content, sink, 'hearth.stoked', { actors: [c.id], place: colony.hearth });
  }
}

function actChat(ctx: Ctx, c: Colonist, task: Extract<Colonist['task'], { kind: 'chat' }>): void {
  const { world, content, sink } = ctx;
  const partner = world.colonists[task.partner];
  const together = partner && partner.task.kind === 'chat' && partner.task.partner === c.id;
  if (!together) {
    c.task = { kind: 'idle' };
    return;
  }
  if (!task.lead) return;
  task.progress += 1;
  if (task.progress < content.tuning.chatTicks) return;
  const t = content.tuning;
  for (const who of [c, partner])
    who.needs.company = Math.min(t.needMax, who.needs.company + t.chatValue);
  emit(world, content, sink, 'chatted', {
    actors: [c.id, partner.id],
    place: { x: c.x, y: c.y },
    causes: [c.openNeedEvents.company?.id, partner.openNeedEvents.company?.id],
  });
  c.task = { kind: 'idle' };
  partner.task = { kind: 'idle' };
}

// ---- Helpers ----

function storeTile(world: WorldState): number {
  return tileIndex(world.map, world.colony.store.x, world.colony.store.y);
}

function setPath(ctx: Ctx, c: Colonist, goal: number): boolean {
  const path = findPath(ctx.world.map, tileIndex(ctx.world.map, c.x, c.y), goal);
  if (!path) return false;
  c.path = path;
  return true;
}

/** Paths to and claims the nearest unclaimed tile with this feature and something left on it. */
function nearestFeature(ctx: Ctx, c: Colonist, feature: Feature): number[] | null {
  const { map } = ctx.world;
  const here = tileIndex(map, c.x, c.y);
  const path = findNearest(
    map,
    here,
    (i) => map.feature[i] === feature && map.amount[i]! > 0 && map.reservedBy[i] === 0,
  );
  if (!path) return null;
  release(ctx, c);
  claim(ctx, c, path.length ? path[path.length - 1]! : here);
  c.path = path;
  return path;
}

function takeUnit({ world, content }: Ctx, index: number): void {
  const { map } = world;
  map.amount[index] = map.amount[index]! - 1;
  if (map.feature[index] === Feature.Bush) {
    if (map.regrowAt[index] === 0)
      map.regrowAt[index] = world.tick + content.tuning.bushRegrowTicks;
  } else if (map.feature[index] === Feature.Tree && map.amount[index] === 0) {
    map.feature[index] = Feature.None;
  }
}

function claim(ctx: Ctx, c: Colonist, index: number): void {
  const { world } = ctx;
  release(ctx, c);
  world.map.reservedBy[index] = c.id + 1;
  c.claim = index;
}

function release({ world }: Ctx, c: Colonist): void {
  if (c.claim >= 0 && world.map.reservedBy[c.claim] === c.id + 1) world.map.reservedBy[c.claim] = 0;
  c.claim = -1;
}
