// Public engine API. The engine is pure: same seed and content, same world, tick for tick.

import type { EventSink } from './core/events.ts';
import type { Content, SimEvent, WorldState } from './core/types.ts';
import { tickColony } from './colony/tick.ts';

export { createWorld } from './world/create.ts';
export { renderEvent } from './narrative/render.ts';
export { describeTask } from './narrative/describe.ts';
export { clockAt, isNight } from './core/time.ts';
export { jobDemand, rankJobs } from './colony/tick.ts';
export * from './core/types.ts';

/** Advances the world by `ticks` ticks and returns the events emitted, oldest first. */
export function step(world: WorldState, content: Content, ticks = 1): SimEvent[] {
  const sink: EventSink = { events: [] };
  for (let i = 0; i < ticks; i += 1) tickColony(world, content, sink);
  return sink.events;
}
