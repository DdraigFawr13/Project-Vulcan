// Roofs (6B Bundle 3, P6.11, amends V-056): a built house or room stands without a roof until a
// thatcher lays one (crafts/thatch.ts), and its air leaks `roofs.open` per mille more an hour
// meanwhile (fire/air.ts). Thatch wears: past `roofs.thatch.wears` years it leaks
// `roofs.thatch.worn` more, and the thatcher lays it again. A room placed in test mode belongs to
// no house and keeps the old free roof. Reed comes from `roofs.reed` tiles, straw from reaped
// fields (`roofs.straw.per` of a field's tiles a bundle, once a harvest).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { TICKS_PER_DAY } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import { fieldsOf } from './fields.ts';
import { houseAt } from './beds.ts';
import { sizeOf } from './houses.ts';
import { housesOf, rectOf } from './site.ts';

/** Ticks in a year of the calendar. */
const yearOf = (content: EngineContent): number =>
  content.calendar.daysPerMonth * content.calendar.monthsPerYear * TICKS_PER_DAY;

/** Whole years since house row `h`'s roof was laid. */
export const roofAge = (world: WorldState, content: EngineContent, h: EntityRow): number =>
  Math.floor((world.tick - ((h['roofed'] as number) ?? 0)) / yearOf(content));

/** Whether a house row's roof is worn thatch, to be laid again. */
export const wornThatch = (world: WorldState, content: EngineContent, h: EntityRow): boolean =>
  h['roof'] === 'thatch' && roofAge(world, content, h) >= content.buildings.roofs.thatch.wears;

/** Per mille a room's air loses an hour through its roof, beyond its walls: none for a room of no
 * house (test mode), `open` under no roof, `worn` under worn thatch. */
export function roofLeak(world: WorldState, content: EngineContent, x: number, y: number): number {
  const h = houseAt(world, x, y);
  if (!h || h['state'] !== 'built') return 0;
  const def = content.buildings.roofs;
  if (!h['roof']) return def.open;
  return wornThatch(world, content, h) ? def.thatch.worn : 0;
}

/** Built house rows with no roof, or worn thatch, in id order. */
export const roofsWanted = (world: WorldState, content: EngineContent): EntityRow[] =>
  housesOf(world).filter(
    (h) => h['state'] === 'built' && (!h['roof'] || wornThatch(world, content, h)),
  );

/** Bundles of thatch a house row's roof takes. */
export const bundlesFor = (content: EngineContent, h: EntityRow): number => {
  const r = rectOf(h);
  return Math.ceil((r.w * r.h) / content.buildings.roofs.thatch.per);
};

/** Words for a house row: its size, or "cottage's room" for a room added to a cottage. */
export function roofName(world: WorldState, content: EngineContent, h: EntityRow): string {
  if (!h['of']) return sizeOf(content, h).name;
  const main = housesOf(world).find((m) => m.id === h['of']);
  return main ? `${sizeOf(content, main).name}'s room` : sizeOf(content, h).name;
}

/** Straw bundles a reaped field still holds: a share of its tiles once a harvest. */
export function strawLeft(content: EngineContent, f: EntityRow): number {
  if (f['state'] !== 'fallow' || !((f['got'] as number) > 0)) return 0;
  const all = Math.floor((f['tiles'] as number[]).length / content.buildings.roofs.straw.per);
  const taken = f['strawAt'] === f['sown'] ? ((f['straw'] as number) ?? 0) : 0;
  return Math.max(0, all - taken);
}

/** Takes one bundle of straw from field `f`. */
export function takeStraw(f: EntityRow): void {
  if (f['strawAt'] !== f['sown']) Object.assign(f, { strawAt: f['sown'], straw: 0 });
  f['straw'] = ((f['straw'] as number) ?? 0) + 1;
}

/** Where thatch can be cut within `reach` of `from`: reed tiles, and the first tile of each
 * reaped field with straw left (with the field), nearest `from` first, ties in tile order. */
export function thatchSpots(
  world: WorldState,
  content: EngineContent,
  from: Spot,
): { at: Spot; field?: EntityRow }[] {
  const { width, height, tiles } = world.map;
  const def = content.buildings.roofs;
  const reed = new Set(def.reed.map((id) => content.terrain.kinds.findIndex((k) => k.id === id)));
  const r = def.thatch.reach;
  const out: { at: Spot; field?: EntityRow; d: number }[] = [];
  for (let y = Math.max(0, from.y - r); y <= Math.min(height - 1, from.y + r); y += 1)
    for (let x = Math.max(0, from.x - r); x <= Math.min(width - 1, from.x + r); x += 1)
      if (reed.has(tiles[y * width + x]!))
        out.push({ at: { x, y, z: 0 }, d: Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) });
  for (const f of fieldsOf(world)) {
    if (strawLeft(content, f) < 1) continue;
    const i = (f['tiles'] as number[])[0]!;
    const at = { x: i % width, y: Math.floor(i / width), z: 0 };
    const d = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y));
    if (d <= r) out.push({ at, field: f, d });
  }
  out.sort((a, b) => a.d - b.d || a.at.y - b.at.y || a.at.x - b.at.x);
  return out.map(({ at, field }) => (field ? { at, field } : { at }));
}
