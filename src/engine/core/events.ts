import type { Content, Point, SimEvent, WorldState } from './types.ts';

/** Collects events emitted during one step. */
export interface EventSink {
  events: SimEvent[];
}

/** Appends an event and returns its id. Refuses types without a content definition. */
export function emit(
  world: WorldState,
  content: Content,
  sink: EventSink,
  type: string,
  fields: {
    actors?: number[];
    place?: Point | null;
    causes?: (number | undefined)[];
    data?: Record<string, string | number>;
  } = {},
): number {
  if (!content.events[type]) throw new Error(`Event type "${type}" has no content definition.`);
  const id = world.nextEventId;
  world.nextEventId += 1;
  sink.events.push({
    id,
    tick: world.tick,
    type,
    actors: fields.actors ?? [],
    place: fields.place ?? null,
    causes: (fields.causes ?? []).filter((cause): cause is number => cause !== undefined),
    data: fields.data ?? {},
  });
  return id;
}
