// Turns ledger lines into text from content templates; salvaged from PR #1's
// src/engine/narrative/render.ts (commit f054061). Text only describes what the engine decided.
import type { SimEvent } from '../core/index.ts';
import type { Templates } from './emit';

/** Fills a template's slots: `{actorN}` and `{subjectN}` through `nameOf`, others from data. */
export function renderEvent(
  event: SimEvent,
  templates: Templates,
  nameOf: (id: number) => string = (id) => `#${id}`,
): string {
  const template = templates.get(event.type);
  if (template === undefined) return event.type;
  return template.replace(/\{(\w+)\}/g, (slot, key: string) => {
    const role = /^(actor|subject)(\d+)$/.exec(key);
    if (role) {
      const id = (role[1] === 'actor' ? event.actors : event.subjects)[Number(role[2])];
      return id === undefined ? slot : nameOf(id);
    }
    const value = event.data[key];
    return value === undefined ? slot : String(value);
  });
}

/** The ledger as NDJSON, one event per line: the export format and the determinism digest. */
export const toNdjson = (events: readonly SimEvent[]): string =>
  events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : '');
