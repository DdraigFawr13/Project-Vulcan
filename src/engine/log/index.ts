// Public surface of the ledger: emit with its template check, text rendering and NDJSON.
export { emit, templatesOf } from './emit';
export type { EventFields, Templates } from './emit';
export { renderEvent, toNdjson } from './render';
