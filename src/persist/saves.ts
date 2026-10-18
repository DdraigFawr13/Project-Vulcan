// Saves in the browser's IndexedDB: database "ledger", schema version 2. "meta" and "saves" are
// keyed by the same generated id: "meta" holds what the save list shows (small, read together),
// "saves" the save records (large, read one at a time when loading). "segments" (P2.0) holds the
// ledger's sealed days, gzipped, by their key; saves name them, never hold them.
import type { SaveFile } from '../worker/index.ts';

const DB = 'ledger';
const SCHEMA = 2;
/** The one autosave slot: each autosave replaces the last. Manual saves get a fresh id each. */
export const AUTOSAVE_ID = 'autosave';
/** The one rescue slot (P2.0): the last good copy of a game the engine stopped on. */
export const RESCUE_ID = 'rescue';

/** One row of the save list. */
export interface SaveMeta {
  id: string;
  name: string;
  seed: string;
  tick: number;
  /** Real time it was written (ms since 1970), for the list's order and its "saved at". */
  savedAt: number;
  auto: boolean;
  /** Set on the rescue save: why the game stopped. */
  rescue?: string;
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
  /** Archives sealed ledger days (NDJSON), gzipped; a key already stored is the same text. */
  putSegments(segments: readonly { key: string; text: string }[]): Promise<void>;
  /** A sealed day's NDJSON, gzipped, or undefined when this browser does not hold it. */
  getSegment(key: string): Promise<ArrayBuffer | undefined>;
}

/** `text` gzipped. Gzip files joined end to end are one gzip file, so the ledger download is the
 * stored days and the recent ones side by side, never one huge string. */
export const gzip = (text: string): Promise<ArrayBuffer> =>
  new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();

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
async function write(
  db: IDBDatabase,
  doing: string,
  work: (tx: IDBTransaction) => void,
  stores = ['meta', 'saves'],
) {
  let tx: IDBTransaction;
  try {
    tx = db.transaction(stores, 'readwrite');
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
    open.onupgradeneeded = (e) => {
      if (e.oldVersion < 1) {
        open.result.createObjectStore('meta', { keyPath: 'id' });
        open.result.createObjectStore('saves');
      }
      if (e.oldVersion < 2) open.result.createObjectStore('segments');
    };
    // Refused while an older tab holds the database; if the upgrade finishes once that tab
    // closes, the late connection is let go, so it never blocks the next upgrade.
    let refused = false;
    open.onblocked = () => {
      refused = true;
      reject(new Error('Saves are unavailable: another tab of the game is holding them open.'));
    };
    open.onerror = () => reject(reason(open.error, 'opening'));
    open.onsuccess = () => (refused ? open.result.close() : resolve(storeOf(open.result)));
  });
}

function storeOf(db: IDBDatabase): SaveStore {
  // Another tab upgrading the schema asks this one to let go.
  db.onversionchange = () => db.close();
  return {
    async put(fields, save) {
      const meta: SaveMeta = {
        ...fields,
        id: fields.rescue
          ? RESCUE_ID
          : fields.auto
            ? AUTOSAVE_ID
            : `save-${fields.savedAt}-${crypto.randomUUID()}`,
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
    async putSegments(segments) {
      // Compressed before the transaction opens: an IndexedDB transaction closes across an await.
      const packed = await Promise.all(
        segments.map(async (s) => [s.key, await gzip(s.text)] as const),
      );
      await write(
        db,
        'archiving the ledger',
        (tx) => {
          for (const [key, data] of packed) tx.objectStore('segments').put(data, key);
        },
        ['segments'],
      );
    },
    getSegment(key) {
      return read(
        () =>
          db.transaction('segments').objectStore('segments').get(key) as IDBRequest<
            ArrayBuffer | undefined
          >,
        'reading the ledger archive',
      );
    },
  };
}
