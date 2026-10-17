// The scheduler and the lever queue: one tick applies that tick's commands, then runs the
// systems that are due, in list order.
import { streamFor, ticksPerMonth, TICKS_PER_DAY, TICKS_PER_HOUR } from '../core/index.ts';
import type { Command, EventData, WorldState } from '../core/index.ts';
import { emit } from '../log/index.ts';
import type { Cadence, System, SystemContext } from './system';
import { createWorld, type Sim } from './world';

/**
 * Queues a command and returns it as stamped. It applies on `max(asked, world.tick + 1)`, so a
 * lever sent while the worker runs ahead is a tick late, never lost (ARCHITECTURE "Worker protocol").
 */
export function submitCommand(
  world: WorldState,
  command: { tick: number; kind: string; data?: EventData },
): Command {
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
  return stamped;
}

// Keeps `pending` sorted by tick then seq; seq only grows, so insert after every command due no later.
function enqueue(world: WorldState, command: Command): void {
  let at = world.pending.length;
  while (at > 0 && world.pending[at - 1]!.tick > command.tick) at -= 1;
  world.pending.splice(at, 0, command);
}

function context(world: WorldState, sim: Sim, system: System): SystemContext {
  return {
    world,
    content: sim.content,
    state: world.systems[system.id]!,
    rng() {
      if (!system.stream) throw new Error(`System "${system.id}" has no RNG stream.`);
      return streamFor(world, system.stream);
    },
    emit: (type, fields) => emit(world, sim.templates, type, fields),
  };
}

function due(every: Cadence, tick: number, sim: Sim): boolean {
  if (every === 'minute') return true;
  if (every === 'hour') return tick % TICKS_PER_HOUR === 0;
  if (every === 'day') return tick % TICKS_PER_DAY === 0;
  return tick % ticksPerMonth(sim.content.calendar) === 0;
}

function applyCommand(world: WorldState, sim: Sim, command: Command): void {
  const system = sim.systems.find((s) => s.commands?.[command.kind]);
  const data = { kind: command.kind, asked: command.asked, seq: command.seq };
  if (!system) {
    emit(world, sim.templates, 'command.refused', { data: { ...data, reason: 'unknown order' } });
    return;
  }
  const cause = emit(world, sim.templates, 'command.applied', { data });
  system.commands![command.kind]!(context(world, sim, system), command, cause);
}

/** Advances the world by `ticks` game minutes. Returns the events written, oldest first. */
export function step(world: WorldState, sim: Sim, ticks = 1): WorldState['log'] {
  const from = world.log.length;
  for (let i = 0; i < ticks; i += 1) {
    world.tick += 1;
    while (world.pending[0] && world.pending[0].tick <= world.tick)
      applyCommand(world, sim, world.pending.shift()!);
    for (const system of sim.systems)
      if (system.run && due(system.every, world.tick, sim)) system.run(context(world, sim, system));
  }
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
