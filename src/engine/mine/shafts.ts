// The shaft table and what the colony wants of each metal (V-086, V-087).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';
import { haveOf, ingotWant } from '../goods/index.ts';

export const MINE_TABLES: Schemas = {
  /** `to`: the level of the vein; `state`: one of `SHAFT_STATES`; `depth`: the deepest level sunk
   * so far (0 at first); `sentBack`: 1 for the plan that replaced one sent back, which cannot be
   * sent back again; `line`: the line that planned it. */
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

/** Planned, sinking, done (sunk to the vein), sent (plan sent back) or spent (done, but no way to
 * a vein opened from it). */
export const SHAFT_STATES = ['planned', 'sinking', 'done', 'sent', 'spent'] as const;

/** The states of a shaft that is no longer live: its place is kept clear of the next plan. */
export const GONE: readonly string[] = ['sent', 'spent'];

export const shaftsOf = (world: WorldState): EntityRow[] => world.entities['shaft'] ?? [];

/** The shaft being or to be sunk or dug from for a metal, if any (one sent back or spent does
 * not count). */
export const shaftFor = (world: WorldState, metal: string): EntityRow | undefined =>
  shaftsOf(world).find((s) => s['metal'] === metal && !GONE.includes(s['state'] as string));

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

/** A content sentence with its `{slot}`s filled from `data` (a slot with no datum stays). */
export const fill = (template: string, data: Readonly<Record<string, string | number>>): string =>
  template.replace(/\{(\w+)\}/g, (slot, key: string) => String(data[key] ?? slot));
