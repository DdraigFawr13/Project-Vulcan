// Siting the metal stations from need (Phase 4 Bundle 3, V-041, V-049, V-061, V-070): nobody
// places a smelter. The first time an ingot is wanted and the ore (or the ingots an alloy mixes)
// lies in the colony's hands, the colony plans a smelter just outside the town ring, on the side
// nearest the shaft head (any stairs or shaft on the surface, else the store). When the smelter
// needs charcoal and none is held, it marks a 2 by 2 clamp spot beside it. Nothing is drawn from
// a stream: ties go in tile order, so the same seed gives the same sites.
import type { EngineContent, WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import {
  charcoalNeeded,
  haveOf,
  plannedRuns,
  raiseStock,
  storeOf,
  wantedBy,
} from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { openGround } from './hearths.ts';
import { livePastures, onPastureGround } from './pasturerows.ts';
import { ringOf } from './ring.ts';
import { sizeOfStation, stationOf } from './station.ts';

const cheb = (a: Spot, x: number, y: number): number =>
  Math.max(Math.abs(a.x - x), Math.abs(a.y - y));

/** The stairs or shaft on the surface nearest the green (ties in tile order), else the store's
 * first tile, else the green: where the smelter wants to be near, and a word for it. */
function headOf(world: WorldState, content: EngineContent, green: Spot): Spot & { word: string } {
  const map = world.map;
  const dials = content.terrain.generator.underground;
  const heads = [dials.shaft, dials.stairs, dials.stairsDown, dials.stairsUp].map((id) =>
    content.terrain.kinds.findIndex((k) => k.id === id),
  );
  let best: Spot | undefined;
  let far = Infinity;
  for (let i = 0; i < map.tiles.length; i += 1) {
    if (!heads.includes(map.tiles[i]!)) continue;
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    if (cheb(green, x, y) < far) [best, far] = [{ x, y, z: 0 }, cheb(green, x, y)];
  }
  if (best) return { ...best, word: 'the shaft head' };
  const first = storeOf(world)[0];
  return first
    ? { x: first['x'] as number, y: first['y'] as number, z: 0, word: 'the store' }
    : { ...green, word: 'the green' };
}

/** Which way `to` lies from the green, for the ledger. */
function sideOf(green: Spot, to: Spot): string {
  const [dx, dy] = [to.x - green.x, to.y - green.y];
  const ns = Math.abs(dy) * 2 > Math.abs(dx) ? (dy < 0 ? 'north' : 'south') : '';
  const ew = Math.abs(dx) * 2 > Math.abs(dy) ? (dx < 0 ? 'west' : 'east') : '';
  return `${ns}${ew}` || 'by the green';
}

/** Free ground for a `size` by `size` station with its top-left at (x, y). */
export function freeBlock(
  world: WorldState,
  content: EngineContent,
  x: number,
  y: number,
  size: number,
) {
  for (let dy = 0; dy < size; dy += 1)
    for (let dx = 0; dx < size; dx += 1) {
      const fields = (world.entities['field'] ?? []).filter((f) => f['state'] !== 'sent');
      const i = (y + dy) * world.map.width + x + dx;
      if (!openGround(world, content, x + dx, y + dy)) return false;
      if (fields.some((f) => (f['tiles'] as number[]).includes(i))) return false;
      if (livePastures(world).some((p) => onPastureGround(p, world.map.width, x + dx, y + dy)))
        return false;
    }
  return true;
}

/** The best free block for the smelter: outside the ring, within `smelter.reach` of it, nearest
 * the head, then nearest the ring, then in tile order, that someone can walk to from the green. */
function smelterSite(
  world: WorldState,
  content: EngineContent,
  green: Spot,
  head: Spot,
): Spot | undefined {
  const map = world.map;
  const [ring, size] = [ringOf(world, content), content.metal.smelter.size];
  const reach = ring + content.metal.smelter.reach;
  const found: { at: Spot; score: number }[] = [];
  for (let y = Math.max(1, green.y - reach); y <= Math.min(map.height - 2, green.y + reach); y += 1)
    for (
      let x = Math.max(1, green.x - reach);
      x <= Math.min(map.width - 2, green.x + reach);
      x += 1
    ) {
      const out = cheb(green, x, y);
      if (out <= ring || out > reach || !freeBlock(world, content, x, y, size)) continue;
      found.push({ at: { x, y, z: 0 }, score: cheb(head, x, y) * 100 + (out - ring) });
    }
  found.sort((a, b) => a.score - b.score || a.at.y - b.at.y || a.at.x - b.at.x);
  return found.find((f) => canReach(content, map, green, f.at))?.at;
}

/** How far from the smelter a clamp spot may be. */
const CLAMP_REACH = 10;

/** The free 2 by 2 block nearest the smelter, in tile order at a tie, reachable from it. */
function clampSite(
  world: WorldState,
  content: EngineContent,
  smelter: Spot,
  size: number,
): Spot | undefined {
  const found: { at: Spot; score: number }[] = [];
  // Out to CLAMP_REACH tiles: in forest the ground right by the smelter can all be trees (anvil
  // never had a clamp, so never smelted; P4.9).
  for (let y = smelter.y - size - CLAMP_REACH; y <= smelter.y + CLAMP_REACH + 1; y += 1)
    for (let x = smelter.x - size - CLAMP_REACH; x <= smelter.x + CLAMP_REACH + 1; x += 1) {
      if (x < 1 || y < 1 || !freeBlock(world, content, x, y, size)) continue;
      const near = Math.max(
        Math.abs(x + (size - 1) / 2 - smelter.x),
        Math.abs(y + (size - 1) / 2 - smelter.y),
      );
      found.push({ at: { x, y, z: 0 }, score: near * 10 });
    }
  found.sort((a, b) => a.score - b.score || a.at.y - b.at.y || a.at.x - b.at.x);
  return found.find((f) => canReach(content, world.map, smelter, f.at))?.at;
}

const nameOf = (content: EngineContent, kind: string): string =>
  content.items.find((i) => i.id === kind)?.name ?? kind;

/** Hourly: plans the smelter the first time an ingot is wanted and fillable, and the clamp spot
 * once the smelter needs charcoal and none is held. */
export function planStations(ctx: SystemContext, green: Spot): void {
  const { world, content } = ctx;
  const runs = plannedRuns(world, content);
  const wanted = content.metal.recipes.find((r) => (runs.get(r.id) ?? 0) > 0);
  let smelter = stationOf(world, 'smelter');
  if (!smelter && wanted) {
    const head = headOf(world, content, green);
    const at = smelterSite(world, content, green, head);
    const by = wantedBy(world, content, wanted.id);
    if (!at || !by) return;
    const have = wanted.inputs.find((i) => i.kind !== content.metal.clamp.item)!;
    const line = ctx.emit('metal.smelterPlanned', {
      causes: [by.line],
      data: {
        where: `${sideOf(green, at)} of the green, towards ${head.word}`,
        why: `${by.name} are wanted and ${nameOf(content, have.kind)} lies in the store`,
      },
    });
    const size = sizeOfStation(content, 'smelter');
    addEntity(world, 'station', {
      ...{ kind: 'smelter', x: at.x, y: at.y, z: 0, w: size, h: size, state: 'plan', line },
      ...{ have: 0, work: -1, made: 0, lit: 0, litLine: 0, alert: 0, waitFor: '' },
    });
    raiseStock(ctx, content.metal.smelter.material, 'smelter', line);
    smelter = stationOf(world, 'smelter');
  }
  const fuel = content.metal.clamp.item;
  if (!smelter || stationOf(world, 'clamp') || haveOf(world, content, fuel) > 0) return;
  if (charcoalNeeded(world, content) <= 0) return;
  const at = clampSite(
    world,
    content,
    { x: smelter['x'] as number, y: smelter['y'] as number, z: 0 },
    content.metal.clamp.size,
  );
  if (!at) return;
  const size = sizeOfStation(content, 'clamp');
  const line = ctx.emit('metal.clampPlanned', {
    causes: [smelter['line'] as number],
    data: {
      where: 'near the smelter',
      why: `the smelter needs ${nameOf(content, fuel)} and the colony has none`,
    },
  });
  addEntity(world, 'station', {
    ...{ kind: 'clamp', x: at.x, y: at.y, z: 0, w: size, h: size, state: 'idle', line },
    ...{ have: 0, work: -1, made: 0, lit: 0, litLine: 0, alert: 0, waitFor: '' },
  });
}
