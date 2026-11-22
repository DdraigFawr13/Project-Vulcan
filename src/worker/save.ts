// The save record and its check. The worker builds a save from the running world and checks one
// before it replaces the running world, so a refused save never touches the game in progress.
import { type Schemas, tablesProblem, type WorldState } from '../engine/index.ts';
import { fitsContent, isObject, stateShaped, type SaveContent } from './savecheck.ts';

/** Raised when a save's format version changes; older saves need not load before launch. */
export const SAVE_VERSION = 6;

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

/** The world in `save`, or a throw naming why it cannot be loaded with this content. */
export function checkSave(
  save: unknown,
  contentHash: string,
  content: SaveContent,
  tables: Schemas,
): WorldState {
  if (!isObject(save) || !isObject(save['state'])) throw new Error('The save is damaged.');
  if (save['version'] !== SAVE_VERSION)
    throw new Error(
      `It was saved by another version of the game (save format ${String(save['version'])}, this game reads ${SAVE_VERSION}).`,
    );
  if (save['contentHash'] !== contentHash)
    throw new Error(
      `It was made with different game content (${String(save['contentHash'])} in the save, ${contentHash} here).`,
    );
  if (!stateShaped(save['state'], save)) throw new Error('The save is damaged.');
  const world = save['state'] as unknown as WorldState;
  // Deeper checks a matching content hash makes cheap (savecheck.ts).
  if (!fitsContent(world, content)) throw new Error('The save is damaged.');
  const tablesWrong = tablesProblem(world, tables);
  if (tablesWrong) throw new Error(`The save is damaged: ${tablesWrong}.`);
  return world;
}
