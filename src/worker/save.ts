// The save record and its check. The worker builds a save from the running world and checks one
// before it replaces the running world, so a refused save never touches the game in progress.
import { type Schemas, tablesProblem, type WorldState } from '../engine/index.ts';
import { fitsContent, isObject, stateShaped, type SaveContent } from './savecheck.ts';

/** Raised when a save's format version changes; older saves need not load before launch. */
export const SAVE_VERSION = 8;

/** One saved game (docs/ARCHITECTURE.md "Save"). The command log and ledger live in `state`;
 * `seed` and `tick` repeat `state`'s as a header readable without walking the world, and
 * `checkSave` requires the two to agree. */
export interface SaveFile {
  version: number;
  seed: string;
  /** New-game settings; none until worldgen options arrive in Phase 1. */
  params: Record<string, string | number>;
  contentHash: string;
  tick: number;
  state: WorldState;
}

/** The save of `world`. It holds the live world by reference: the caller posts it at once, and
 * posting copies it, so the page never holds the running world. */
export const saveOf = (world: WorldState, contentHash: string): SaveFile => ({
  version: SAVE_VERSION,
  seed: world.seed,
  params: {},
  contentHash,
  tick: world.tick,
  state: world,
});

/** Raised for a save from another format or other content, not a damaged one: the page says the
 * version changed only for these. */
export class OtherVersion extends Error {}

/**
 * Gives `hurt: 0` to each animal row that lacks it. Lambs born before 2026-11-22 were made without
 * the field, so their saves failed the table check; no system reads a lamb's `hurt`, and 0 is what
 * every other animal starts with, so the mended world plays on as it would have.
 */
function mendLambs(world: WorldState): void {
  const animals = world.entities['animal'];
  if (!Array.isArray(animals)) return;
  for (const row of animals)
    if (row && typeof row === 'object' && !('hurt' in row)) row['hurt'] = 0;
}

/**
 * Gives the lord's and the reeve's rows the fields they lack, at their starting values: the lord
 * was copied without his last take's fields (6C Slice 4), so a save between the first visit and
 * the second was refused; and 6C Slice 7 (V-240) added his own coming and the elder's plea, and the
 * reeve's riding with him. The mended world plays on as it would have.
 */
function mendLord(world: WorldState): void {
  const add = (table: string, fields: Readonly<Record<string, number | string>>) => {
    const rows = world.entities[table];
    if (Array.isArray(rows))
      for (const row of rows)
        if (row && typeof row === 'object')
          for (const [k, v] of Object.entries(fields)) if (!(k in row)) row[k] = v;
  };
  add('lord', { tithed: 0, tookAt: 0, took: '', came: 0, plea: 0 });
  add('reeve', { lord: 0, feast: 0, wait: 0, judged: 0, favourIn: 0 });
}

/** The world in `save`, or a throw naming why it cannot be loaded with this content. */
export function checkSave(
  save: unknown,
  contentHash: string,
  content: SaveContent,
  tables: Schemas,
): WorldState {
  if (!isObject(save) || !isObject(save['state'])) throw new Error('The save is damaged.');
  if (save['version'] !== SAVE_VERSION)
    throw new OtherVersion(
      `It was saved by another version of the game (save format ${String(save['version'])}, this game reads ${SAVE_VERSION}).`,
    );
  if (save['contentHash'] !== contentHash)
    throw new OtherVersion(
      `It was made with different game content (${String(save['contentHash'])} in the save, ${contentHash} here).`,
    );
  if (!stateShaped(save['state'], save)) throw new Error('The save is damaged.');
  const world = save['state'] as unknown as WorldState;
  // Deeper checks a matching content hash makes cheap (savecheck.ts).
  if (!fitsContent(world, content)) throw new Error('The save is damaged.');
  mendLambs(world);
  mendLord(world);
  const tablesWrong = tablesProblem(world, tables);
  if (tablesWrong) throw new Error(`The save is damaged: ${tablesWrong}.`);
  return world;
}
