// Foul water (P5.7, V-136): a drink within `sick.foulNear` tiles of the midden or a fold, or from
// a lake in warm weather (`sick.warmLake` degrees), is one exposure to `sick.foulIll` (the flux, health `expose`),
// with the water tile kept so the band can shun it once the flux shows. A well is never foul.
import { WATER, type EntityRow } from '../core/index.ts';
import { foldTiles, livePastures, middensOf, wellsOf } from '../build/index.ts';
import { expose } from '../health/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** Why a drink at surface tile `tile` is foul, in words, with the line behind it; or undefined. */
function foulness(ctx: SystemContext, tile: number): { how: string; cause: number } | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const [x, y] = [tile % map.width, Math.floor(tile / map.width)];
  if (wellsOf(world).some((w) => w['x'] === x && w['y'] === y)) return undefined;
  const near = content.health.sick.foulNear;
  const within = (tx: number, ty: number) => Math.max(Math.abs(tx - x), Math.abs(ty - y)) <= near;
  const water = WATER[map.water[tile] ?? 0] || 'water';
  const midden = middensOf(world).find((m) => within(m.x, m.y));
  if (midden) return { how: `drank from the ${water} by the midden`, cause: midden.line };
  const fold = livePastures(world).find((p) =>
    foldTiles(map.width, p).some((t) => within(t % map.width, Math.floor(t / map.width))),
  );
  if (fold) return { how: `drank from the ${water} by the fold`, cause: fold['line'] as number };
  const temp = (world.systems['weather']?.['temp'] as number | undefined) ?? 0;
  if (water === 'lake' && temp >= content.health.sick.warmLake)
    return {
      how: 'drank from the lake in the warm weather',
      cause: (world.systems['weather']?.['spell'] as number | undefined) ?? 0,
    };
  return undefined;
}

/** `p` drank at `tile`: a foul drink may give them the flux. */
export function drankAt(ctx: SystemContext, p: EntityRow, tile: number): void {
  const foul = foulness(ctx, tile);
  if (foul)
    expose(ctx, p, ctx.content.health.sick.foulIll, foul.how, [foul.cause], { water: tile + 1 });
}
