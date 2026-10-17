// The append-only event log. Milestone 1 keeps it in memory and exports NDJSON (one event per
// line, ready for pandas.read_json(lines=True)). The sql.js store from the concept slots in
// behind this same interface when it is approved (docs/DECISIONS.md D-005).

import type { LoggedEvent } from './protocol.ts';

export interface EventLog {
  append(events: readonly LoggedEvent[]): void;
  readonly size: number;
  toNdjson(): string;
}

export class MemoryEventLog implements EventLog {
  private readonly events: LoggedEvent[] = [];

  append(events: readonly LoggedEvent[]): void {
    this.events.push(...events);
  }

  get size(): number {
    return this.events.length;
  }

  toNdjson(): string {
    return this.events.map((event) => JSON.stringify(event)).join('\n') + '\n';
  }
}
