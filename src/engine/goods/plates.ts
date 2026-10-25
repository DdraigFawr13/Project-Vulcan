// Stock plates and stores (P4.7 review, 5B Bundle 1): a plated good is carried in only while the
// stores hold its plate; past it, goods go only to a store of their own kind, and without one stay
// where they lie (a lever that bounds making a good also bounds what is stored of it, LESSONS).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { itemsOf, stackSize } from './stacks.ts';
import { inStore, wantOf } from './store.ts';

/** The Stock plate a kind counts towards: its own, else its good's. */
function plateOf(content: EngineContent, kind: string): string | undefined {
  if (content.work.stock.some((s) => s.good === kind)) return kind;
  const g = content.items.find((d) => d.id === kind)?.good;
  return g && content.work.stock.some((s) => s.good === g) ? g : undefined;
}

/** Whether the stores already hold what a Stock plate asks of this item's kind (at least a
 * stack): then the rest goes only to a store of its kind, else stays where it lies. Builders fetch
 * from where it lies. A kind counts towards its own plate, else its good's (grain and turnips are
 * food: a harvest of 3,000 grain filled the store 225 days a year on every seed, the Phase 4
 * review). Kinds with no plate of either are always carried. */
export function storedEnough(world: WorldState, content: EngineContent): (i: EntityRow) => boolean {
  const stored = new Map<string, number>();
  for (const i of itemsOf(world)) {
    if (i['holder'] || !inStore(world, i['x'] as number, i['y'] as number, i['z'] as number))
      continue;
    const plate = plateOf(content, i['kind'] as string);
    if (plate) stored.set(plate, (stored.get(plate) ?? 0) + (i['count'] as number));
  }
  return (i) => {
    const kind = i['kind'] as string;
    const plate = plateOf(content, kind);
    if (!plate) return false;
    const keep = Math.max(wantOf(world, content, plate), stackSize(content, kind));
    return (stored.get(plate) ?? 0) >= keep;
  };
}
