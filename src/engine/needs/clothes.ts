// Clothes and warmth (V-092, P5.5, V-134): outdoors, on the surface and not in a built house,
// everything a person wears adds its `warmth` to the temperature they feel. Each hour everyday
// clothes wear an hour while their wearer is awake, and an outer layer an hour outdoors, or
// clothes.json `cold` hours outdoors under the comfort line (without it). At 0 a garment is gone,
// with a line citing the one that made it. Worn to its last `ragged` per cent it leaves a memory.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { houseAt } from '../build/index.ts';
import { removeEntity } from '../entity/index.ts';
import { garmentOf, leftOf, wornOf } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addMemory } from './memory.ts';

/** On the surface and not in a built house. */
export const outdoors = (world: WorldState, p: EntityRow): boolean =>
  p['z'] === 0 &&
  !((houseAt(world, p['x'] as number, p['y'] as number)?.['built'] as number | undefined) ?? 0);

/** Degrees the clothes they wear add where they stand. */
export function clothesWarmth(world: WorldState, content: EngineContent, p: EntityRow): number {
  if (!outdoors(world, p)) return 0;
  return wornOf(world, p.id).reduce(
    (n, i) => n + (garmentOf(content, i['kind'] as string)?.warmth ?? 0),
    0,
  );
}

const nameOf = (content: EngineContent, kind: string): string =>
  content.items.find((i) => i.id === kind)?.name ?? kind;

/** One hour's wear on everything `p` wears; `felt` is the temperature without their clothes. */
export function wearClothes(ctx: SystemContext, p: EntityRow, felt: number): void {
  const { world, content } = ctx;
  const out = outdoors(world, p);
  const awake = p['doing'] !== 'sleep';
  let ragged = 0;
  for (const item of wornOf(world, p.id)) {
    const g = garmentOf(content, item['kind'] as string);
    if (!g) continue;
    const by =
      g.slot === content.clothes.slots[0]!.id
        ? +awake
        : out
          ? felt < content.life.warmth.comfort
            ? content.clothes.cold
            : 1
          : 0;
    item['wear'] = Math.max(0, (item['wear'] as number) - by);
    if (item['wear']) {
      if (!ragged && leftOf(content, item) < content.clothes.ragged)
        ragged = item['made'] as number;
      continue;
    }
    removeEntity(world, 'item', item.id);
    ctx.emit('goods.wornOut', {
      causes: [item['made'] as number].filter((l) => l > 0),
      actors: [p.id],
      data: { name: p['name'] as string, what: nameOf(content, item['kind'] as string) },
    });
  }
  // A non-stacking memory, refreshed each hour they stay ragged; it cites the garment's making.
  if (ragged) addMemory(ctx, p.id, content.clothes.memories.ragged, ragged);
}
