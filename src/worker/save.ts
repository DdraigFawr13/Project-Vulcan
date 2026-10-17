// The save record and its check. The worker builds a save from the running world and checks one
// before it replaces the running world, so a refused save never touches the game in progress.
import type { WorldState } from '../engine/index.ts';

/** Raised when a save's format version changes; older saves need not load before launch. */
export const SAVE_VERSION = 1;

/** One saved game (docs/ARCHITECTURE.md "Save"). The command log and ledger live in `state`. */
export interface SaveFile {
  version: number;
  seed: string;
  /** New-game settings; none until worldgen options arrive in Phase 1. */
  params: Record<string, string | number>;
  contentHash: string;
  tick: number;
  state: WorldState;
}

/** The save of `world`. The caller posts it, so the page receives a copy, not the live world. */
export const saveOf = (world: WorldState, contentHash: string): SaveFile => ({
  version: SAVE_VERSION,
  seed: world.seed,
  params: {},
  contentHash,
  tick: world.tick,
  state: world,
});

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;

/** The world in `save`, or a throw naming why it cannot be loaded with this content. */
export function checkSave(save: unknown, contentHash: string): WorldState {
  if (!isObject(save) || !isObject(save['state'])) throw new Error('The save is damaged.');
  if (save['version'] !== SAVE_VERSION)
    throw new Error(
      `It was saved by another version of the game (save format ${String(save['version'])}, this game reads ${SAVE_VERSION}).`,
    );
  if (save['contentHash'] !== contentHash)
    throw new Error(
      `It was made with different game content (${String(save['contentHash'])} in the save, ${contentHash} here).`,
    );
  const state = save['state'];
  const map = state['map'];
  const ok =
    typeof state['seed'] === 'string' &&
    state['seed'] === save['seed'] &&
    isCount(state['tick']) &&
    state['tick'] === save['tick'] &&
    isCount(state['nextEventId']) &&
    isCount(state['nextCommandSeq']) &&
    isCount(state['begunEvent']) &&
    isObject(state['rng']) &&
    isObject(state['systems']) &&
    Array.isArray(state['commandLog']) &&
    Array.isArray(state['pending']) &&
    Array.isArray(state['log']) &&
    isObject(map) &&
    isCount(map['width']) &&
    isCount(map['height']) &&
    Array.isArray(map['tiles']) &&
    map['tiles'].length === map['width'] * map['height'] &&
    Array.isArray(map['tileCauses']) &&
    map['tileCauses'].length === map['tiles'].length &&
    Array.isArray(map['chunkVersions']);
  if (!ok) throw new Error('The save is damaged.');
  return state as unknown as WorldState;
}
