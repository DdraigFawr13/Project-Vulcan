// Public surface of the persist layer: the save store in IndexedDB and the ledger download.
export { AUTOSAVE_ID, gzip, openSaves, RESCUE_ID } from './saves.ts';
export type { SaveMeta, SaveStore } from './saves.ts';
export { download } from './download.ts';
