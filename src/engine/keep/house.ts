// The smokehouse, sited from need (5B Bundle 3, V-041, V-132): nobody places it. When fresh meat,
// game and fish (`cure.from`) lost over the kept weeks reaches `cure.need.count` and no smokehouse
// stands or is planned, the colony plans a square of `cure.house.size` on the free ground nearest
// the larder (else the home store), within `cure.house.near` tiles, that someone can walk to from
// the green; ties go in tile order. Builders build it (people/station.ts).
import type { EntityRow, WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { freeBlock, greenOf, sizeOfStation, stationOf } from '../build/index.ts';
import { depotsOf, onDepot, raiseStock, storeKindOf, storeOf } from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lostLine, lostOf } from './lost.ts';

/** The larder's middle (a built one before a planned one), else the home store's first tile. */
function anchorOf(world: WorldState, kind: string): (Spot & { word: string }) | undefined {
  const larders = depotsOf(world)
    .filter((d) => d['store'] === kind)
    .sort((a, b) => +(b['state'] === 'built') - +(a['state'] === 'built') || a.id - b.id);
  const d: EntityRow | undefined = larders[0];
  if (d)
    return {
      x: (d['x'] as number) + Math.floor((d['w'] as number) / 2),
      y: (d['y'] as number) + Math.floor((d['h'] as number) / 2),
      z: 0,
      word: 'the larder',
    };
  const first = storeOf(world)[0];
  return first && { x: first['x'] as number, y: first['y'] as number, z: 0, word: 'the store' };
}

/** Daily: plans the smokehouse once enough fresh meat and fish has spoiled. */
export function planHouse(ctx: SystemContext): void {
  const { world, content } = ctx;
  const def = content.work.cure;
  if (stationOf(world, 'smokehouse')) return;
  const lost = lostOf(world, def.from);
  if (lost < def.need.count) return;
  const anchor = anchorOf(world, storeKindOf(content, def.from[0]!)?.id ?? '');
  if (!anchor) return;
  const map = world.map;
  const [size, near] = [def.house.size, def.house.near];
  const green = greenOf(world);
  const found: { at: Spot; score: number }[] = [];
  for (let y = Math.max(1, anchor.y - near); y <= anchor.y + near; y += 1)
    for (let x = Math.max(1, anchor.x - near); x <= anchor.x + near; x += 1) {
      if (x + size >= map.width || y + size >= map.height || !freeBlock(world, content, x, y, size))
        continue;
      // Not on the edge or the inside of a store, built or planned.
      let clear = true;
      for (let dy = 0; dy < size; dy += 1)
        for (let dx = 0; dx < size; dx += 1)
          if (depotsOf(world).some((d) => onDepot(d, x + dx, y + dy))) clear = false;
      if (!clear) continue;
      const far = Math.max(
        Math.abs(2 * x + size - 1 - 2 * anchor.x),
        Math.abs(2 * y + size - 1 - 2 * anchor.y),
      );
      found.push({ at: { x, y, z: 0 }, score: far });
    }
  found.sort((a, b) => a.score - b.score || a.at.y - b.at.y || a.at.x - b.at.x);
  const at = found.find((f) => canReach(content, map, green, f.at))?.at;
  if (!at) return;
  const cause = lostLine(world, def.from);
  const line = ctx.emit('cure.housePlanned', {
    causes: cause ? [cause] : [],
    data: {
      where: `by ${anchor.word}`,
      why: def.why.replace('{count}', String(lost)),
    },
  });
  const s = sizeOfStation(content, 'smokehouse');
  addEntity(world, 'station', {
    ...{ kind: 'smokehouse', x: at.x, y: at.y, z: 0, w: s, h: s, state: 'plan', line },
    ...{ have: 0, work: -1, made: 0, lit: 0, litLine: 0, alert: 0, waitFor: '' },
  });
  raiseStock(ctx, def.house.material, 'smokehouse', line);
}
