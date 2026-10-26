// The midden (P5.4a, V-072). When the first offal lies about (the waste of a kill), the colony
// sites a one-tile midden just past the town ring, on flat dry ground away from houses, fields and
// water, as it does the burial ground. Haulers carry offal, and nothing else, there, where it is
// used up with no line (people/haul.ts). The pack's hungry nights bring it to the midden first
// (wild `setLures`, called by the people system from `middensOf`). Sited once; never sent back.
import type { EntityRow, WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { dryAt, freeTile, itemsOf } from '../goods/index.ts';
import { reachFrom, walkAt, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { liveFields, tilesOf } from './fields.ts';
import { dirFrom } from './houses.ts';
import { ringOf } from './ring.ts';
import { housesOf, rectOf } from './site.ts';

export const MIDDEN_TABLES: Schemas = {
  /** The midden's tile and the line that sited it. */
  midden: { x: 'int', y: 'int', line: 'event' },
};

const rowsOf = (world: WorldState): EntityRow[] => world.entities['midden'] ?? [];

/** The middens sited (at most one), for the screens and the haulers. */
export const middensOf = (world: WorldState): { x: number; y: number; z: number; line: number }[] =>
  rowsOf(world).map((m) => ({
    x: m['x'] as number,
    y: m['y'] as number,
    z: 0,
    line: m['line'] as number,
  }));

/** Whether surface tile (x, y) is the midden. */
export const atMidden = (world: WorldState, x: number, y: number): boolean =>
  rowsOf(world).some((m) => m['x'] === x && m['y'] === y);

/** The nearest tile to the green, past the ring, that fits; undefined when none does. */
function siteMidden(ctx: SystemContext, green: Spot): Spot | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const def = content.work.midden;
  const ring = ringOf(world, content);
  const apart = def.apart;
  const houses = housesOf(world).map(rectOf);
  const fields = new Set(liveFields(world).flatMap((f) => tilesOf(f)));
  const reach = reachFrom(content, map, green);
  const near = (x: number, y: number, r: number, hit: (i: number) => boolean): boolean => {
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) {
        const [tx, ty] = [x + dx, y + dy];
        if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height && hit(ty * map.width + tx))
          return true;
      }
    return false;
  };
  const tiles: { x: number; y: number; d: number }[] = [];
  const span = ring + def.past + 24;
  for (let y = green.y - span; y <= green.y + span; y += 1)
    for (let x = green.x - span; x <= green.x + span; x += 1) {
      const d = Math.max(Math.abs(x - green.x), Math.abs(y - green.y));
      if (d > ring + def.past - 1 && d <= span)
        tiles.push({ x, y, d: (x - green.x) * (x - green.x) + (y - green.y) * (y - green.y) });
    }
  tiles.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  for (const t of tiles) {
    const i = t.y * map.width + t.x;
    if (t.x < 0 || t.y < 0 || t.x >= map.width || t.y >= map.height) continue;
    // The cheap tile tests first: freeTile scans every item and row, and most tiles fail sooner.
    if (map.features[i] || !walkAt(content, map, 0, i) || walkAt(content, map, 0, i) > def.walk)
      continue;
    if (
      houses.some(
        (h) =>
          t.x >= h.x - apart &&
          t.x < h.x + h.w + apart &&
          t.y >= h.y - apart &&
          t.y < h.y + h.h + apart,
      )
    )
      continue;
    if (near(t.x, t.y, apart, (j) => fields.has(j) || !dryAt(content, map, j))) continue;
    if (!freeTile(world, content, t.x, t.y)) continue;
    if (reach({ x: t.x, y: t.y, z: 0 })) return { x: t.x, y: t.y, z: 0 };
  }
  return undefined;
}

/** Each hour: the first offal lies about and there is no midden yet: site one. */
export function planMidden(ctx: SystemContext, green: Spot): void {
  const { world, content } = ctx;
  if (rowsOf(world).length) return;
  const waste = content.work.haul.midden;
  const first = itemsOf(world).find((i) => waste.includes(i['kind'] as string));
  if (!first) return;
  const at = siteMidden(ctx, green);
  if (!at) return;
  const line = ctx.emit('build.middenSited', {
    causes: [first['made'] as number].filter((c) => c > 0),
    data: {
      far: Math.max(Math.abs(at.x - green.x), Math.abs(at.y - green.y)),
      dir: dirFrom(green, { x: at.x, y: at.y, w: 1, h: 1 }),
    },
  });
  addEntity(world, 'midden', { x: at.x, y: at.y, line });
}
