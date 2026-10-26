// The loom and flax (Phase 5B Bundle 5, P5.5, V-134): pure reads. A loom is wanted when fleece or
// flax lies waiting to be woven and the colony has none: it goes against a wall in a room with a
// hearth, else the hall, else the largest room (carpentry makes it, like any piece). Flax is sown in place of a beans
// course while the everyday clothes wanted are more than the wool and linen to hand can make.
import type { EngineContent, WorldState } from '../core/index.ts';
import { haveOf, shortOf } from '../goods/index.ts';
import { cropOf, liveFields, tilesOf } from './fields.ts';
import { furnitureOf } from './furniture.ts';
import { HEARTH } from './hearths.ts';
import { mainOf } from './houses.ts';
import { roomsOf, siteFor, type RoomRow, type Want } from './wants.ts';

const recipeOf = (content: EngineContent, makes: string) =>
  content.clothes.weave.recipes.find((r) => r.makes === makes);

/** What lies waiting to be woven: each weave recipe's input in the colony, with its name. */
export function toWeave(world: WorldState, content: EngineContent) {
  return content.clothes.weave.recipes.flatMap((r) =>
    r.from.map((f) => ({ kind: f.kind, count: haveOf(world, content, f.kind), need: f.count })),
  );
}

/** Whether linen is short: everyday clothes wanted beyond what the wool, linen, fleece and flax in
 * hand and the flax growing can make. */
export function flaxWanted(world: WorldState, content: EngineContent): boolean {
  const short = shortOf(world, content, content.clothes.slots[0]!.id);
  if (short <= 0) return false;
  const linen = recipeOf(content, 'linen');
  const per = linen?.from[0]?.count ?? 1;
  const flax = cropOf(content, content.clothes.flax.crop);
  const growing = liveFields(world)
    .filter((f) => f['crop'] === flax?.id)
    .reduce((n, f) => n + tilesOf(f).length * (flax?.yield ?? 0), 0);
  const cloth =
    haveOf(world, content, 'wool') +
    haveOf(world, content, 'fleece') +
    haveOf(world, content, 'linen') +
    Math.floor((haveOf(world, content, linen?.from[0]?.kind ?? 'flax') + growing) / per);
  return cloth < short;
}

/** Where a loom would go, when one is wanted: none stands or is planned, and something waits to
 * be woven. In a room with a hearth, the hall first, else the hall or the largest room. */
export function loomWant(world: WorldState, content: EngineContent): Want | undefined {
  const piece = content.clothes.loom.piece;
  if (furnitureOf(world).some((f) => f['kind'] === piece)) return undefined;
  const waiting = toWeave(world, content).find((w) => w.count >= w.need);
  if (!waiting) return undefined;
  const hearthIn = (rr: RoomRow) => {
    const inside = new Set(rr.room.tiles);
    const w = world.map.width;
    return furnitureOf(world).some(
      (f) =>
        f['kind'] === HEARTH &&
        f['state'] === 'built' &&
        inside.has((f['y'] as number) * w + (f['x'] as number)),
    );
  };
  // A warm room first (one with a hearth), then the hall, then the largest: early on the only
  // fire is the campfire on the green, and the weaving cannot wait for the first winter.
  const rooms = roomsOf(world, content).sort(
    (a, b) =>
      +hearthIn(b) - +hearthIn(a) ||
      +!!mainOf(world, b.h)['hall'] - +!!mainOf(world, a.h)['hall'] ||
      b.room.tiles.length - a.room.tiles.length,
  );
  const name = content.items.find((i) => i.id === waiting.kind)?.name ?? waiting.kind;
  for (const rr of rooms) {
    const at = siteFor(world, content, rr, piece);
    if (at)
      return {
        kind: piece,
        rr,
        at,
        have: 0,
        need: 1,
        why: `${waiting.count} ${name} wait to be woven`,
      };
  }
  return undefined;
}
