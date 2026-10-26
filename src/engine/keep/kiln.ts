// The kiln, sited from need (5B Bundle 3, V-041, V-132): nobody places it. When grain, oats and
// beans (`potter.kinds`) lost at walled stores over the kept weeks reach `potter.kiln.need`, or a
// planned house wall lacks its material, and clay can be had (it lies in a store, or a miner could
// dig some), and no kiln stands or is planned, the colony plans a `potter.kiln.size` square at the
// edge of town: on the free ground nearest the green between `potter.kiln.near` tiles from it
// that someone can walk to, ties in tile order. A kiln blocks no one's way (stations leave
// `map.built` alone), so it seals nothing. Builders build it (people/station.ts).
import type { WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import {
  digsFor,
  freeBlock,
  greenOf,
  planPart,
  plansOf,
  sizeOfStation,
  stationOf,
} from '../build/index.ts';
import { depotsOf, haveOf, onDepot, raiseStock } from '../goods/index.ts';
import { canReach, reachFrom, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lostLine, lostOf } from './lost.ts';

/** The first planned house wall whose material the colony has none of, if any. */
function lacking(ctx: SystemContext) {
  const { world, content } = ctx;
  return plansOf(world).find((p) => {
    const part = planPart(content, p);
    return (
      p['state'] === 'plan' &&
      !!p['house'] &&
      part.kind === 'wall' &&
      haveOf(world, content, part.material) < 1
    );
  });
}

/** Whether clay lies in a store or some known clay ground a miner could get beside would give it. */
function clayCanBeHad(ctx: SystemContext, green: Spot): boolean {
  const { world, content } = ctx;
  const def = content.work.potter;
  if (haveOf(world, content, def.clayItem) >= def.clay) return true;
  const layer = world.map.levels[0];
  if (!layer) return false;
  const reach = reachFrom(content, world.map, green);
  return layer.tiles.some((_, i) => digsFor(world, content, reach, i, def.clayItem));
}

/** Whether a square at (x, y) overlaps a store, built or planned. */
const onStore = (world: WorldState, x: number, y: number, size: number): boolean =>
  depotsOf(world).some((d) => {
    for (let dy = 0; dy < size; dy += 1)
      for (let dx = 0; dx < size; dx += 1) if (onDepot(d, x + dx, y + dy)) return true;
    return false;
  });

/** Daily: plans the kiln once grain has spoiled or a wall lacks its material, and clay can be had. */
export function planKiln(ctx: SystemContext): void {
  const { world, content } = ctx;
  const def = content.work.potter;
  if (stationOf(world, 'kiln')) return;
  const lost = lostOf(world, def.kinds, 'walled');
  const wall = lost < def.kiln.need ? lacking(ctx) : undefined;
  if (lost < def.kiln.need && !wall) return;
  const green = greenOf(world);
  if (!clayCanBeHad(ctx, green)) return;
  const map = world.map;
  const [size, [least = 0, most = 0]] = [def.kiln.size, def.kiln.near];
  const found: { at: Spot; score: number }[] = [];
  for (let y = Math.max(1, green.y - most - size); y <= green.y + most + size; y += 1)
    for (let x = Math.max(1, green.x - most - size); x <= green.x + most + size; x += 1) {
      if (x + size >= map.width || y + size >= map.height) continue;
      const far = Math.max(
        Math.abs(2 * x + size - 1 - 2 * green.x),
        Math.abs(2 * y + size - 1 - 2 * green.y),
      );
      if (far < 2 * least || far > 2 * most) continue;
      if (!freeBlock(world, content, x, y, size) || onStore(world, x, y, size)) continue;
      found.push({ at: { x, y, z: 0 }, score: far });
    }
  found.sort((a, b) => a.score - b.score || a.at.y - b.at.y || a.at.x - b.at.x);
  const at = found.find((f) => canReach(content, map, green, f.at))?.at;
  if (!at) return;
  const cause = wall ? (wall['line'] as number) : lostLine(world, def.kinds, 'walled');
  const line = ctx.emit('potter.kilnPlanned', {
    causes: cause ? [cause] : [],
    data: {
      where: 'at the edge of town',
      why: (wall ? def.kiln.whyWalls : def.kiln.why).replace('{count}', String(lost)),
    },
  });
  const s = sizeOfStation(content, 'kiln');
  addEntity(world, 'station', {
    ...{ kind: 'kiln', x: at.x, y: at.y, z: 0, w: s, h: s, state: 'plan', line },
    ...{ have: 0, work: -1, made: 0, lit: 0, litLine: 0, alert: 0, waitFor: '' },
  });
  raiseStock(ctx, def.kiln.material, 'kiln', line);
}
