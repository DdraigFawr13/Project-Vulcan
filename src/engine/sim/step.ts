// The scheduler and the lever queue: one tick applies that tick's commands, then runs the
// systems that are due, in list order.
import { ticksPerMonth, TICKS_PER_DAY, TICKS_PER_HOUR } from '../core/index.ts';
import type { Command, EventData, SimEvent, WorldState } from '../core/index.ts';
import { citedByEntities } from '../entity/index.ts';
import { emit, sealDays } from '../log/index.ts';
import { contextFor, type Cadence } from './system.ts';
import { createWorld, type Sim } from './world.ts';

/**
 * Queues a command and returns it as stamped. It applies on `max(asked, world.tick + 1)`, so a
 * lever sent while the worker runs ahead is a tick late, never lost (ARCHITECTURE "Worker protocol").
 */
export function submitCommand(
  world: WorldState,
  command: { tick: number; kind: string; data?: EventData },
): Command {
  if (!Number.isSafeInteger(command.tick))
    throw new Error(
      `Command "${command.kind}" asks for tick ${command.tick}; ticks are whole minutes.`,
    );
  const stamped: Command = {
    tick: Math.max(command.tick, world.tick + 1),
    asked: command.tick,
    seq: world.nextCommandSeq,
    kind: command.kind,
    data: { ...command.data },
  };
  world.nextCommandSeq += 1;
  world.commandLog.push(stamped);
  enqueue(world, stamped);
  return { ...stamped, data: { ...stamped.data } };
}

// Keeps `pending` sorted by tick then seq; seq only grows, so insert after every command due no later.
function enqueue(world: WorldState, command: Command): void {
  let at = world.pending.length;
  while (at > 0 && world.pending[at - 1]!.tick > command.tick) at -= 1;
  world.pending.splice(at, 0, command);
}

function due(every: Cadence, tick: number, sim: Sim): boolean {
  if (every === 'minute') return true;
  if (every === 'hour') return tick % TICKS_PER_HOUR === 0;
  if (every === 'day') return tick % TICKS_PER_DAY === 0;
  return tick % ticksPerMonth(sim.content.calendar) === 0;
}

function applyCommand(world: WorldState, sim: Sim, command: Command): void {
  const system = sim.systems.find((s) => s.commands && Object.hasOwn(s.commands, command.kind));
  const data = { kind: command.kind, asked: command.asked, seq: command.seq };
  if (!system) {
    emit(world, sim.templates, 'command.refused', { data: { ...data, reason: 'unknown order' } });
    return;
  }
  const cause = emit(world, sim.templates, 'command.applied', { data });
  system.commands![command.kind]!(contextFor(world, sim, system), command, cause);
}

/** Every ledger id the world points at outside the log: tiles' last changes, systems' state refs
 * and entity fields. What the seal keeps as stubs. */
function cited(world: WorldState, sim: Sim): Set<number> {
  const ids = new Set<number>();
  const { map } = world;
  // Neighbouring tiles mostly share a cause (the line that made the valley or reached a level), so
  // a repeat is skipped before it reaches the set: a midnight scans up to 112,500 tiles.
  for (const layer of [map, ...map.levels]) {
    if (!layer) continue;
    let last = -1;
    for (const id of layer.tileCauses) if (id !== last) ids.add((last = id));
  }
  for (const system of sim.systems)
    for (const key of system.refs ?? []) {
      const id = world.systems[system.id]?.[key];
      if (id) ids.add(id);
    }
  citedByEntities(world, sim.tables, ids);
  return ids;
}

// Whether a line from id `from` on is one `stop` names, looking back from the newest.
function wrote(log: WorldState['log'], from: number, stop: StopAt): boolean {
  const hit = typeof stop === 'function' ? stop : (e: SimEvent) => stop.has(e.type);
  for (let k = log.length - 1; k >= 0 && log[k]!.id >= from; k -= 1) if (hit(log[k]!)) return true;
  return false;
}

/** Where `step` stops early: a set of event types, or a test such as `sim.notable`. */
export type StopAt = ReadonlySet<string> | ((event: SimEvent) => boolean);

/**
 * Advances the world by `ticks` game minutes, sealing old days at each midnight. With `stopAt`,
 * stops after the first tick that writes a line it names (P2.7's skip ahead passes `sim.notable`). Returns
 * the lines written that are still recent, oldest first; they are the ledger's own records, so
 * treat them as read-only.
 */
export function step(world: WorldState, sim: Sim, ticks = 1, stopAt?: StopAt): WorldState['log'] {
  const fromId = world.nextEventId;
  for (let i = 0; i < ticks; i += 1) {
    const before = world.nextEventId;
    world.tick += 1;
    while (world.pending[0] && world.pending[0].tick <= world.tick)
      applyCommand(world, sim, world.pending.shift()!);
    for (const system of sim.systems)
      if (system.run && due(system.every, world.tick, sim))
        system.run(contextFor(world, sim, system));
    if (world.tick % TICKS_PER_DAY === 0) sealDays(world, cited(world, sim), sim.recentDays);
    if (stopAt && wrote(world.log, before, stopAt)) break;
  }
  // Lines written this call that are still recent: a run over a week returns the last week.
  let from = world.log.length;
  while (from > 0 && world.log[from - 1]!.id >= fromId) from -= 1;
  return world.log.slice(from);
}

/** Rebuilds a world from its seed and command log: the save format's determinism check. */
export function replay(
  sim: Sim,
  seed: string,
  commandLog: readonly Command[],
  toTick: number,
): WorldState {
  const world = createWorld(sim, seed);
  // Re-queue each command exactly as it was stamped, so its tick, asked tick and seq match.
  for (const c of commandLog) {
    const copy = { ...c, data: { ...c.data } };
    world.commandLog.push(copy);
    enqueue(world, copy);
  }
  world.nextCommandSeq = (commandLog.at(-1)?.seq ?? 0) + 1;
  step(world, sim, toTick - world.tick);
  return world;
}
