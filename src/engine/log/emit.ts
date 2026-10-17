// Writes ledger lines. Salvaged from PR #1's src/engine/core/events.ts (commit f054061) and
// reshaped to the event record of docs/ARCHITECTURE.md "Event log".
import type { EventData, SimEvent, WorldState } from '../core/index.ts';

export interface EventFields {
  actors?: readonly number[];
  subjects?: readonly number[];
  causes?: readonly number[];
  data?: EventData;
}

/** Event type to template text, built once from content. */
export type Templates = ReadonlyMap<string, string>;

const SLOT = /\{(\w+)\}/g;
const slotCache = new WeakMap<Templates, Map<string, string[]>>();

function slotsOf(templates: Templates, type: string): string[] | undefined {
  let byType = slotCache.get(templates);
  if (!byType) {
    byType = new Map();
    slotCache.set(templates, byType);
  }
  let slots = byType.get(type);
  if (!slots) {
    const template = templates.get(type);
    if (template === undefined) return undefined;
    slots = [...template.matchAll(SLOT)].map((m) => m[1]!);
    byType.set(type, slots);
  }
  return slots;
}

/** Whether `fields` fill the slot: `actor0`, `subject1` or a data key. */
function filled(slot: string, fields: EventFields): boolean {
  const role = /^(actor|subject)(\d+)$/.exec(slot);
  if (role)
    return (role[1] === 'actor' ? fields.actors : fields.subjects)?.[Number(role[2])] !== undefined;
  return fields.data !== undefined && Object.hasOwn(fields.data, slot);
}

/**
 * Appends an event to the world's ledger and returns its id. Throws when the type has no
 * template, the template has a slot the fields leave empty (DECISIONS V-006), or a cause is not
 * an earlier line, so every "why?" chain ends at a real line.
 */
export function emit(
  world: WorldState,
  templates: Templates,
  type: string,
  fields: EventFields = {},
): number {
  const slots = slotsOf(templates, type);
  if (!slots) throw new Error(`Event type "${type}" has no template in content events.`);
  for (const slot of slots)
    if (!filled(slot, fields))
      throw new Error(`Event "${type}": template needs "${slot}", which the event didn't give.`);
  for (const cause of fields.causes ?? [])
    if (!Number.isInteger(cause) || cause < 1 || cause >= world.nextEventId)
      throw new Error(`Event "${type}": cause ${cause} is not an earlier ledger line.`);
  const event: SimEvent = {
    id: world.nextEventId,
    tick: world.tick,
    type,
    actors: [...(fields.actors ?? [])],
    subjects: [...(fields.subjects ?? [])],
    causes: [...(fields.causes ?? [])],
    data: { ...fields.data },
  };
  world.nextEventId += 1;
  world.log.push(event);
  return event.id;
}

/** Builds the template map from content's event list. */
export const templatesOf = (events: readonly { id: string; template: string }[]): Templates =>
  new Map(events.map((e) => [e.id, e.template]));
