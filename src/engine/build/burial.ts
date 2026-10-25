// The burial ground (P5.8, V-116). At the first death the colony lays out a plot just past the
// town ring, `health.burial` w by h tiles (a grave a tile, with a hurdle edge drawn round it):
// free, dry ground with no water beside it and no field on it, nearest the green. It can be sent
// back once until the first grave is dug (`sendBack {burial}`), and the colony chooses again at
// once. Graves are dug by the people (people/burial.ts) and filled at day's end (health).
import type { EntityRow, WorldState } from '../core/index.ts';
import { dryAt, freeTile } from '../goods/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { liveFields, tilesOf } from './fields.ts';
import { dirFrom } from './houses.ts';
import { livePastures, onPastureGround } from './pasturerows.ts';
import { ringOf } from './ring.ts';
import { inRect, type Rect } from './site.ts';

export const BURIAL_TABLES: Schemas = {
  /** The plot: its rectangle, the line that laid it out, `state` `laid` or `sent` (sent back:
   * never chosen again) and `sent` 1 when it replaced one sent back (it cannot be sent back). */
  burial: {
    x: 'int',
    y: 'int',
    w: 'count',
    h: 'count',
    line: 'event',
    state: 'text',
    sent: 'count',
  },
  /** A grave: who lies there, its tile, `by` who dug it, `line` their taking up the burial,
   * `marker` 1 for a carved wooden marker, `state` `dug` (until day's end) or `filled`, and
   * `buried` the burial line. */
  grave: {
    person: 'entity',
    x: 'int',
    y: 'int',
    by: 'entity',
    line: 'event',
    marker: 'count',
    state: 'text',
    buried: 'event',
  },
};

export const burialsOf = (world: WorldState): EntityRow[] => world.entities['burial'] ?? [];
export const gravesOf = (world: WorldState): EntityRow[] => world.entities['grave'] ?? [];

/** The burial ground in use, if laid out. */
export const burialGround = (world: WorldState): EntityRow | undefined =>
  burialsOf(world).find((b) => b['state'] === 'laid');

const rect = (b: EntityRow): Rect => ({
  x: b['x'] as number,
  y: b['y'] as number,
  w: b['w'] as number,
  h: b['h'] as number,
});

/** Whether surface tile (x, y) is in a burial ground laid out. */
export const inBurial = (world: WorldState, x: number, y: number): boolean =>
  burialsOf(world).some((b) => b['state'] === 'laid' && inRect(rect(b), x, y));

/** The plot tiles of the ground with no grave, in tile order. */
export function freePlots(world: WorldState): Spot[] {
  const b = burialGround(world);
  if (!b) return [];
  const r = rect(b);
  const dug = new Set(gravesOf(world).map((g) => `${g['x']},${g['y']}`));
  const out: Spot[] = [];
  for (let y = r.y; y < r.y + r.h; y += 1)
    for (let x = r.x; x < r.x + r.w; x += 1) if (!dug.has(`${x},${y}`)) out.push({ x, y, z: 0 });
  return out;
}

/** The nearest block past the ring that fits, away from water, fields and a plot sent back. */
function siteBurial(ctx: SystemContext, green: Spot): Rect | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const { w, h } = content.health.burial;
  const ring = ringOf(world, content);
  const fields = new Set(liveFields(world).flatMap((f) => tilesOf(f)));
  const pastures = livePastures(world);
  const sent = burialsOf(world)
    .filter((b) => b['state'] === 'sent')
    .map(rect);
  const reach = ring + 24;
  const blocks: { x: number; y: number; d: number }[] = [];
  for (let y = green.y - reach; y <= green.y + reach; y += 1)
    for (let x = green.x - reach; x <= green.x + reach; x += 1) {
      const [dx, dy] = [2 * x + w - 1 - 2 * green.x, 2 * y + h - 1 - 2 * green.y];
      blocks.push({ x, y, d: dx * dx + dy * dy });
    }
  blocks.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const wet = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && !dryAt(content, map, y * map.width + x);
  for (const b of blocks) {
    const r = { x: b.x, y: b.y, w, h };
    if (sent.some((s) => s.x < r.x + w && r.x < s.x + s.w && s.y < r.y + h && r.y < s.y + s.h))
      continue;
    let fits = true;
    for (let y = r.y; y < r.y + h && fits; y += 1)
      for (let x = r.x; x < r.x + w && fits; x += 1)
        fits =
          Math.max(Math.abs(x - green.x), Math.abs(y - green.y)) > ring &&
          freeTile(world, content, x, y) &&
          !fields.has(y * map.width + x) &&
          !pastures.some((p) => onPastureGround(p, map.width, x, y)) &&
          !map.features[y * map.width + x] &&
          ![-1, 0, 1].some((ox) => [-1, 0, 1].some((oy) => wet(x + ox, y + oy)));
    if (fits) return r;
  }
  return undefined;
}

/** Lays out a burial ground citing `cause`, unless one is laid out or none fits. */
function layBurial(ctx: SystemContext, green: Spot, dead: EntityRow, cause: number, sent: number) {
  const r = siteBurial(ctx, green);
  if (!r) return;
  const centre = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
  const line = ctx.emit('build.burialSited', {
    causes: [cause].filter((c) => c > 0),
    data: {
      name: dead['name'] as string,
      far: Math.max(Math.abs(centre.x - green.x), Math.abs(centre.y - green.y)),
      dir: dirFrom(green, r),
      width: r.w,
      height: r.h,
    },
  });
  addEntity(ctx.world, 'burial', { ...r, line, state: 'laid', sent });
}

/** Each hour: the dead need a burial ground and there is none laid out. */
export function planBurial(ctx: SystemContext, green: Spot): void {
  const { world } = ctx;
  if (burialGround(world)) return;
  const dead = (world.entities['person'] ?? []).find((p) => p['status'] === 'dead');
  if (!dead) return;
  const body = (world.entities['body'] ?? []).find((b) => b['person'] === dead.id);
  const sentBack = burialsOf(world).some((b) => b['state'] === 'sent');
  layBurial(ctx, green, dead, (body?.['died'] as number) || 0, sentBack ? 1 : 0);
}

/** `sendBack {burial}`: once, before any grave is dug; the colony lays out another at once. */
export function sendBackBurial(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
  green: Spot,
): void {
  const { world } = ctx;
  const b = burialsOf(world).find((r) => r.id === data['burial']);
  const why =
    !b || b['state'] !== 'laid'
      ? 'no such plot'
      : b['sent']
        ? 'it was sent back once already'
        : gravesOf(world).length
          ? 'a grave is dug there'
          : undefined;
  if (why) {
    ctx.emit('command.refused', { causes: [cause], data: { kind: 'sendBack', reason: why } });
    return;
  }
  const line = ctx.emit('build.burialSentBack', { causes: [cause, b!['line'] as number] });
  b!['state'] = 'sent';
  const dead = (world.entities['person'] ?? []).find((p) => p['status'] === 'dead');
  if (dead) layBurial(ctx, green, dead, line, 1);
}
