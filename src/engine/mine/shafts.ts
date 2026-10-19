// The shaft table and what the colony wants of each metal (V-086, V-087).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';
import { haveOf, ingotWant } from '../goods/index.ts';

export const MINE_TABLES: Schemas = {
  /** `to`: the level of the vein; `state`: planned, sinking, done or sent (sent back); `depth`:
   * the deepest level sunk so far (0 at first); `sentBack`: 1 for the plan that replaced one sent
   * back, which cannot be sent back again; `line`: the line that planned it. */
  shaft: {
    x: 'int',
    y: 'int',
    metal: 'text',
    to: 'count',
    state: 'text',
    depth: 'count',
    sentBack: 'count',
    line: 'event',
  },
};

export const shaftsOf = (world: WorldState): EntityRow[] => world.entities['shaft'] ?? [];

/** The shaft being or to be sunk for a metal, if any (a plan sent back does not count). */
export const shaftFor = (world: WorldState, metal: string): EntityRow | undefined =>
  shaftsOf(world).find((s) => s['metal'] === metal && s['state'] !== 'sent');

/** The metals that can be mined and smelted: veins (feature ids) whose ingot has a Stock plate. */
export const metalsOf = (content: EngineContent): readonly string[] =>
  content.features
    .filter((f) => f.kind === 'vein' && content.work.stock.some((s) => s.good === `${f.id}-ingot`))
    .map((f) => f.id);

/** The ore item of a metal. */
export const oreOf = (content: EngineContent, metal: string): string =>
  content.features.find((f) => f.id === metal)?.yields ?? `${metal}-ore`;

/** Ore still to find for a metal: what its ingot plate wants (the one function that says, in
 * goods) times `mine.perIngot`, less the ore held anywhere. 0 when the metal is not wanted. */
export function oreShort(world: WorldState, content: EngineContent, metal: string): number {
  const want = ingotWant(world, content, metal) * content.work.mine.perIngot;
  return Math.max(0, want - haveOf(world, content, oreOf(content, metal)));
}
