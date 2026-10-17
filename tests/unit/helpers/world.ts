import { defaultContent as content } from '../../../src/content/index.ts';
import { hashString } from '../../../src/engine/core/rng.ts';
import { createWorld, step, type SimEvent, type WorldState } from '../../../src/engine/index.ts';

export { content };

/** A stable digest of the whole world, typed arrays included. */
export function digest(world: WorldState): number {
  return hashString(
    JSON.stringify(world, (_key, value: unknown) =>
      ArrayBuffer.isView(value) ? Array.from(value as Uint8Array) : value,
    ),
  );
}

/** A world run for `days`, with every event emitted. */
export function runDays(seed: string, days: number): { world: WorldState; events: SimEvent[] } {
  const created = createWorld(seed, content);
  const events = [
    ...created.events,
    ...step(created.world, content, days * content.tuning.ticksPerDay),
  ];
  return { world: created.world, events };
}
