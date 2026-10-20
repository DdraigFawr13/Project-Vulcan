// What a metal's Stock plate is waiting on now, in one short line (Phase 4 review, Morgan). Worked
// out from the facts the engine already keeps: the ingots wanted, the ore and charcoal held, the
// shaft table, the clamp and the person at the smelter. Words only; no rule is decided here
// (GAME-02). Pure reads of the world.
import {
  haveOf,
  ingotWant,
  shaftFor,
  stationOf,
  stockOf,
  type EngineContent,
  type WorldState,
} from '../engine/index.ts';

const nameOf = (content: EngineContent, kind: string): string =>
  (content.items.find((i) => i.id === kind)?.name ?? kind).toLowerCase();

/** The line under `metal`'s ingot plate (a recipe id: copper, tin, iron or bronze). */
export function metalStatus(world: WorldState, content: EngineContent, metal: string): string {
  const r = content.metal.recipes.find((x) => x.id === metal);
  if (!r) return '';
  const people = world.entities['person'] ?? [];
  if (people.some((p) => p['job'] === 'smelt' && p['make'] === metal && p['status'] === 'alive'))
    return 'Smelting now';
  if (ingotWant(world, content, metal) <= 0) {
    const level = stockOf(world, r.makes)?.['level'];
    const count = content.work.stock
      .find((s) => s.good === r.makes)
      ?.levels.find((l) => l.id === level)?.count;
    return count ? 'Enough in store' : 'Nobody wants any';
  }
  const fuel = content.metal.clamp.item;
  const short = r.inputs.find((i) => i.kind !== fuel && haveOf(world, content, i.kind) < i.count);
  if (short) {
    const ore = content.features.find((f) => f.kind === 'vein' && f.yields === short.kind);
    if (!ore) return `Waiting on ${nameOf(content, short.kind)}`;
    const shaft = shaftFor(world, ore.id);
    if (!shaft) return `No shaft yet: no ${ore.id} stain found`;
    if (shaft['state'] === 'planned') return `A shaft to ${ore.id} is planned`;
    if (shaft['state'] === 'sinking') return `Miners are sinking a shaft to ${ore.id}`;
    return `Miners are digging for ${ore.id} ore`;
  }
  const smelter = stationOf(world, 'smelter');
  if (!smelter || smelter['state'] !== 'built') return 'Waiting on a smelter';
  const burn = r.inputs.find((i) => i.kind === fuel)?.count ?? 0;
  if (haveOf(world, content, fuel) < burn) {
    const clamp = stationOf(world, 'clamp');
    if (clamp?.['state'] === 'lit') return 'Waiting on charcoal: the clamp is burning';
    if (people.some((p) => p['job'] === 'charcoal'))
      return 'Waiting on charcoal: the clamp is stacked';
    return clamp ? 'Waiting on charcoal: none burning' : 'Waiting on charcoal: no clamp';
  }
  return 'Ready to smelt';
}
