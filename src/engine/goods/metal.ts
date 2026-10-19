// What the colony wants of metal, and where a piece of it came from (Phase 4 Bundle 3). Wants
// follow the Stock plates (V-041): an ingot plate's level less the ingots held is the want, and
// copper and tin also carry the alloy's inputs for the bronze that is short. Recipes are content
// (metal.json), never written here. An item's `trail` is a compact JSON list of steps that keeps
// saying where it came from after the ledger's days are sealed (P4.6).
import type { EngineContent, EntityRow, RecipeDef, WorldState } from '../core/index.ts';
import { haveOf, stockOf, wantOf } from './store.ts';
import { wornIngots, wornTools } from './tools.ts';

/** One step of an item's trail. `k` is the item the step was for (the ore mined), `n` how many. */
export interface Step {
  s: 'mined' | 'smelted' | 'mixed' | 'burned' | 'made';
  who: string;
  tick: number;
  x?: number;
  y?: number;
  z?: number;
  n?: number;
  k?: string;
}

/** The steps an item carries (none when it has none or the text is not a list). */
export function trailOf(item: Pick<EntityRow, string>): Step[] {
  const text = item['trail'];
  if (typeof text !== 'string' || !text) return [];
  try {
    const steps: unknown = JSON.parse(text);
    return Array.isArray(steps) ? (steps as Step[]) : [];
  } catch {
    return [];
  }
}

export const trailText = (steps: readonly Step[]): string =>
  steps.length ? JSON.stringify(steps) : '';

/** Cuts a trail to `most` steps: the 'burned' steps go first, then the oldest that are not the
 * ore's 'mined', then the oldest. */
function trim(steps: Step[], most: number): Step[] {
  const out = [...steps];
  while (out.length > most) {
    const at = [out.findIndex((x) => x.s === 'burned'), out.findIndex((x) => x.s !== 'mined'), 0];
    out.splice(
      at.find((i) => i >= 0)!,
      1,
    );
  }
  return out;
}

/** The trail with `step` after it. */
export const withStep = (trail: readonly Step[], step: Step, most = 6): Step[] =>
  trim([...trail, step], most);

/** Trails joined in order: the first 'mined' step of each ore kind and each other step once. */
export function mergeTrails(lists: readonly (readonly Step[])[], most = 6): Step[] {
  const seen = new Set<string>();
  const out: Step[] = [];
  for (const step of lists.flat()) {
    const key = step.s === 'mined' ? `mined:${step.k ?? ''}` : JSON.stringify(step);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(step);
  }
  return trim(out, most);
}

/** An ore item's trail; with none yet (Bundle 2's miners stamp the tile), one unknown 'mined'. */
export const oreTrail = (item: EntityRow): Step[] =>
  trailOf(item).length
    ? trailOf(item)
    : [{ s: 'mined', who: '', tick: 0, k: item['kind'] as string }];

const recipeOf = (content: EngineContent, metal: string): RecipeDef | undefined =>
  content.metal.recipes.find((r) => r.id === metal);

/** The ingots colony wants made of `metal` (a recipe id: copper, tin, iron, bronze): its plate's
 * level less the ingots held, never below 0; for the metals a recipe mixes, also the inputs the
 * short alloy needs (whole mixes) less what is held. */
export function ingotWant(world: WorldState, content: EngineContent, metal: string): number {
  const r = recipeOf(content, metal);
  if (!r) return 0;
  // The plate's level, and the ingots worn tools ask for (P4.9).
  let want = wantOf(world, content, r.makes) + wornIngots(world, content, r.makes);
  for (const alloy of content.metal.recipes) {
    const use = alloy.alloy && alloy.inputs.find((i) => i.kind === r.makes);
    if (use) want += Math.ceil(ingotWant(world, content, alloy.id) / alloy.out) * use.count;
  }
  return Math.max(0, want - haveOf(world, content, r.makes));
}

/** Runs each recipe would be made now, in recipe order: as many as are wanted that the ore (or
 * the ingots, with those the runs before will make) can fill. Charcoal is not counted here. */
export function plannedRuns(world: WorldState, content: EngineContent): Map<string, number> {
  const fuel = content.metal.clamp.item;
  const runs = new Map<string, number>();
  const made = new Map<string, number>();
  for (const r of content.metal.recipes) {
    const wanted = Math.ceil(ingotWant(world, content, r.id) / r.out);
    const fill = r.inputs
      .filter((i) => i.kind !== fuel)
      .map((i) => Math.floor((haveOf(world, content, i.kind) + (made.get(i.kind) ?? 0)) / i.count));
    const n = Math.max(0, Math.min(wanted, ...fill));
    runs.set(r.id, n);
    made.set(r.makes, n * r.out);
  }
  return runs;
}

/** Charcoal the runs planned now would burn. */
export function charcoalNeeded(world: WorldState, content: EngineContent): number {
  const fuel = content.metal.clamp.item;
  let need = 0;
  for (const [id, n] of plannedRuns(world, content)) {
    const r = recipeOf(content, id)!;
    need += n * (r.inputs.find((i) => i.kind === fuel)?.count ?? 0);
  }
  return need;
}

/** The Stock plate that wants `metal` made: its own, else the plate of the alloy that needs it
 * (the line of its level, and its name for the ledger). */
export function wantedBy(
  world: WorldState,
  content: EngineContent,
  metal: string,
): { line: number; name: string } | undefined {
  const r = recipeOf(content, metal);
  if (!r) return undefined;
  const row = stockOf(world, r.makes);
  if (row && wantOf(world, content, r.makes) > 0)
    return {
      line: row['line'] as number,
      name: content.work.stock.find((s) => s.good === r.makes)?.name ?? r.makes,
    };
  // A worn tool that asks for these ingots (P4.9) wants them too: its line is the cause.
  const worn = wornTools(world, content).find((w) => w.ingot === r.makes && w.item['worn']);
  if (worn)
    return {
      line: worn.item['worn'] as number,
      name: content.items.find((i) => i.id === r.makes)?.name ?? r.makes,
    };
  for (const alloy of content.metal.recipes)
    if (alloy.alloy && alloy.inputs.some((i) => i.kind === r.makes)) {
      const by = wantedBy(world, content, alloy.id);
      if (by) return by;
    }
  return undefined;
}
