// Public surface of the ledger: emit with its template check, text rendering, NDJSON, "why?" and
// sealing old days.
export { emit, templatesOf } from './emit.ts';
export type { EventFields, Templates } from './emit.ts';
export { renderEvent, toNdjson } from './render.ts';
export { findEvent, recordOf, whyOf } from './why.ts';
export type { Cause } from './why.ts';
export { allLines, RECENT_DAYS, sealDays } from './seal.ts';
export { notableOf } from './notable.ts';
export type { Notable } from './notable.ts';
