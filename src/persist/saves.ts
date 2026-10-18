// Saves in the browser's IndexedDB: database "ledger", schema version 1, two object stores keyed
// by the same generated id. "meta" holds what the save list shows (small, read together); "saves"
// holds the save records (large, read one at a time when loading).
import type { SaveFile } from '../worker/index.ts';

const DB = 'ledger';
const SCHEMA = 1;
/** The one autosave slot: each autosave replaces the last. Manual saves get a fresh id each. */
export const AUTOSAVE_ID = 'autosave';

/** One row of the save list. */
export interface SaveMeta {
  id: string;
  name: string;
  seed: string;
  tick: number;
  /** Real time it was written (ms since 1970), for the list's order and its "saved at". */
  savedAt: number;
  auto: boolean;
  /** A small picture of the map as a data URL; empty when the renderer could not make one. */
  thumbnail: string;
}

export interface SaveStore {
  /** Writes a save; the autosave goes to its one slot, a manual save to a new id. */
  put(meta: Omit<SaveMeta, 'id'>, save: SaveFile): Promise<SaveMeta>;
  /** Every save, newest first. */
  list(): Promise<SaveMeta[]>;
  get(id: string): Promise<SaveFile | undefined>;
  remove(id: string): Promise<void>;
}

// Turns IndexedDB's errors into sentences the save panel can show.
function reason(error: DOMException | null, doing: string): Error {
  if (error?.name === 'QuotaExceededError')
    return new Error(`The browser has no room left for saves (${doing}).`);
  return new Error(`Saves are unavailable (${doing}): ${error?.message ?? 'unknown error'}.`);
}

const done = <T>(request: IDBRequest<T>, doing: string): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(reason(request.error, doing));
  });

const finished = (tx: IDBTransaction, doing: string): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    // A failed request reaches here first, before the transaction carries its error.
    tx.onerror = (e) => reject(reason((e.target as IDBRequest).error, doing));
    tx.onabort = () => reject(reason(tx.error, doing));
  });

// A request started by `start`; a synchronous throw (a closed database) becomes a readable reason.
function read<T>(start: () => IDBRequest<T>, doing: string): Promise<T> {
  try {
    return done(start(), doing);
  } catch (error) {
    return Promise.reject(reason(error as DOMException, doing));
  }
}

// Both stores change together or not at all: a throw part-way aborts the transaction.
async function write(db: IDBDatabase, doing: string, work: (tx: IDBTransaction) => void) {
  let tx: IDBTransaction;
  try {
    tx = db.transaction(['meta', 'saves'], 'readwrite');
  } catch (error) {
    throw reason(error as DOMException, doing);
  }
  const end = finished(tx, doing);
  try {
    work(tx);
  } catch (error) {
    tx.abort();
    end.catch(() => {});
    throw reason(error as DOMException, doing);
  }
  // Commit now rather than when the page next idles: a write made as the page unloads must land.
  tx.commit();
  await end;
}

/** Opens the save database, creating it on first use. */
export function openSaves(): Promise<SaveStore> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Saves are unavailable: this browser has no IndexedDB.'));
      return;
    }
    const open = indexedDB.open(DB, SCHEMA);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('meta', { keyPath: 'id' });
      open.result.createObjectStore('saves');
    };
    open.onblocked = () =>
      reject(new Error('Saves are unavailable: another tab of the game is holding them open.'));
    open.onerror = () => reject(reason(open.error, 'opening'));
    open.onsuccess = () => resolve(storeOf(open.result));
  });
}

function storeOf(db: IDBDatabase): SaveStore {
  // Another tab upgrading the schema asks this one to let go.
  db.onversionchange = () => db.close();
  return {
    async put(fields, save) {
      const meta: SaveMeta = {
        ...fields,
        id: fields.auto ? AUTOSAVE_ID : `save-${fields.savedAt}-${crypto.randomUUID()}`,
      };
      await write(db, 'saving', (tx) => {
        tx.objectStore('saves').put(save, meta.id);
        tx.objectStore('meta').put(meta);
      });
      return meta;
    },
    async list() {
      const all = await read(
        () => db.transaction('meta').objectStore('meta').getAll() as IDBRequest<SaveMeta[]>,
        'listing',
      );
      return all.sort((a, b) => b.savedAt - a.savedAt);
    },
    get: (id) =>
      read(
        () =>
          db.transaction('saves').objectStore('saves').get(id) as IDBRequest<SaveFile | undefined>,
        'loading',
      ),
    async remove(id) {
      await write(db, 'deleting', (tx) => {
        tx.objectStore('saves').delete(id);
        tx.objectStore('meta').delete(id);
      });
    },
  };
}
