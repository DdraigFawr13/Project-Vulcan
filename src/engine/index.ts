// The engine's one public surface. The engine is pure: same seed, content and commands, same
// ledger, tick for tick (DECISIONS V-002, V-006). The worker is the only place it is run.
import { calendarSystem } from './calendar/index.ts';
import { mapSystem } from './map/index.ts';
import type { EngineContent } from './core/index.ts';
import { createSim as createSimWith, type Sim, type System } from './sim/index.ts';

export * from './core/index.ts';
export * from './log/index.ts';
export { createWorld, replay, step, submitCommand } from './sim/index.ts';
export type { Cadence, Sim, System, SystemContext } from './sim/index.ts';
export { calendarSystem } from './calendar/index.ts';
export { CHUNK, chunksAcross, chunksDown, chunkTiles, mapSystem } from './map/index.ts';

/** The game's systems in tick order. Later milestones add theirs here. */
export const SYSTEMS: readonly System[] = [mapSystem, calendarSystem];

/** A simulation over `content` with the game's systems, or the given ones (tests add fixtures). */
export const createSim = (content: EngineContent, systems: readonly System[] = SYSTEMS): Sim =>
  createSimWith(content, systems);
