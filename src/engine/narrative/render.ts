// Turns events into text from content templates. Text only describes what the engine decided;
// an optional model narrator (milestone 5) may rewrite it, never change it.

import type { Colonist, Content, Resource, SimEvent } from '../core/types.ts';

export function renderEvent(
  event: SimEvent,
  colonists: readonly Pick<Colonist, 'id' | 'name'>[],
  content: Content,
): string {
  const def = content.events[event.type];
  if (!def) return event.type;
  return def.template.replace(/\{(\w+)\}/g, (slot, key: string) => {
    const actor = /^actor(\d+)$/.exec(key);
    if (actor) {
      const id = event.actors[Number(actor[1])];
      return colonists.find((c) => c.id === id)?.name ?? slot;
    }
    const value = event.data[key];
    if (value === undefined) return slot;
    if (key === 'resource' && typeof value === 'string' && value in content.resourceWords) {
      return content.resourceWords[value as Resource];
    }
    return String(value);
  });
}
