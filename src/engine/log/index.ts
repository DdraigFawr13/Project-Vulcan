// Public surface of the ledger: emit with its template check, text rendering, NDJSON and "why?".
export { emit, templatesOf } from './emit.ts';
export type { EventFields, Templates } from './emit.ts';
export { renderEvent, toNdjson } from './render.ts';
export { findEvent, whyOf } from './why.ts';
