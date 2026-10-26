// Clothes as goods (Phase 5B Bundle 5, P5.5, V-134): a garment is an item that never stacks, with
// its own wear (hours left) and worth (`quality`). One a slot is worn: held by its owner with
// state `worn`, lying on no tile. Spares lie in a store; the Clothes plate counts them.
import type { EngineContent, EntityRow, GarmentDef, WorldState } from '../core/index.ts';
import { itemsOf, layItem } from './stacks.ts';
import { inStore } from './store.ts';

export const garmentOf = (content: EngineContent, kind: string): GarmentDef | undefined =>
  content.clothes.garments.find((g) => g.item === kind);

/** Hours a new garment of `kind` lasts at worth `quality`. */
export function lifeOf(content: EngineContent, kind: string, quality: string): number {
  const g = garmentOf(content, kind);
  const per = content.clothes.worth.find((w) => w.id === quality)?.last ?? 100;
  return g ? Math.round((g.last * per) / 100) : 0;
}

/** The worth a maker's skill (level plus their roll) gives. */
export const worthFor = (content: EngineContent, skill: number): string =>
  content.clothes.worth.find((w) => skill >= w.at)?.id ?? content.clothes.worth.at(-1)!.id;

/** Everything `person` is wearing. */
export const wornOf = (world: WorldState, person: number): EntityRow[] =>
  itemsOf(world).filter((i) => i['holder'] === person && i['state'] === 'worn');

/** What `person` wears in `slot`, if anything. */
export const wornIn = (
  world: WorldState,
  content: EngineContent,
  person: number,
  slot: string,
): EntityRow | undefined =>
  wornOf(world, person).find((i) => garmentOf(content, i['kind'] as string)?.slot === slot);

/** Per cent of its life a worn garment has left. */
export function leftOf(content: EngineContent, item: EntityRow): number {
  const full = lifeOf(content, item['kind'] as string, item['quality'] as string);
  return full ? Math.round(((item['wear'] as number) * 100) / full) : 0;
}

/** Puts `kind` on `person`, new, citing `made`; returns the item. */
export function putOn(
  world: WorldState,
  content: EngineContent,
  person: EntityRow,
  kind: string,
  made: number,
  quality = 'plain',
): EntityRow {
  const at = { x: person['x'] as number, y: person['y'] as number, z: person['z'] as number };
  const id = layItem(
    world,
    { kind, count: 1, ...at, made },
    { owner: person.id, state: 'worn', quality, wear: lifeOf(content, kind, quality) },
  );
  const item = itemsOf(world).find((i) => i.id === id)!;
  item['holder'] = person.id;
  return item;
}

/** Spare garments of `slot` lying in a store, warmest then best worth first. */
export function sparesOf(world: WorldState, content: EngineContent, slot?: string): EntityRow[] {
  const worth = content.clothes.worth.map((w) => w.id);
  return itemsOf(world)
    .filter((i) => {
      const g = garmentOf(content, i['kind'] as string);
      if (!g || (slot && g.slot !== slot) || i['holder'] || i['state'] === 'worn') return false;
      return inStore(world, i['x'] as number, i['y'] as number, i['z'] as number);
    })
    .sort(
      (a, b) =>
        garmentOf(content, b['kind'] as string)!.warmth -
          garmentOf(content, a['kind'] as string)!.warmth ||
        worth.indexOf(a['quality'] as string) - worth.indexOf(b['quality'] as string) ||
        a.id - b.id,
    );
}
