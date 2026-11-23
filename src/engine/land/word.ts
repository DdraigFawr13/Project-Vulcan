// A newcomer's word (6W Slice 5 part 2, V-206): someone come to stay tells of what they passed on
// the road in, the scouted good whose sources lie thickest along it on land the colony does not
// know. It is a tale that passes and bends, and the next scout who goes for that good leans that
// way (`frontier`); `word.wrong` per cent of the time the newcomer has the way wrong. Nobody is
// sent, and no tile is named.
import { streamFor, type EntityRow } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { compass, faceList, seamAt } from '../map/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { edgeSpot, people } from '../band/index.ts';
import { sourceAt } from './sources.ts';
import { oresWanted, oreWord, seamOres } from './seams.ts';

/** The word held: 1 + the `scout.goods` index it is of (0: none; past the goods, an ore of
 * `seamOres`, V-215), its way out and its line. */
export interface Word {
  good: number;
  dx: number;
  dy: number;
  line: number;
}

/** The word the colony holds of good `k` (a `scout.goods` index), if any. */
export function wordOf(ctx: SystemContext, k: number): Word | undefined {
  const w = ctx.world.systems['word'];
  return w && k >= 0 && w['good'] === k + 1 ? (w as unknown as Word) : undefined;
}

/** The word is acted on: the scout went that way. */
export function spendWord(ctx: SystemContext): void {
  const w = ctx.world.systems['word'];
  if (w) w['good'] = 0;
}

/** Each hour: the newest newcomer not yet heard tells of their road in. */
export function wordHour(ctx: SystemContext): void {
  const { world } = ctx;
  if (world.tick % 60 !== 30) return;
  const state = (world.systems['word'] ??= { seen: 0, good: 0, dx: 0, dy: 0, line: 0 });
  const p = people(world).find(
    (q) =>
      q['status'] === 'alive' &&
      (q['stranger'] as number) > 0 &&
      (q['arrived'] as number) > (state['seen'] ?? 0) &&
      q['z'] === 0,
  );
  if (!p) return;
  state['seen'] = p['arrived'] as number;
  tell(ctx, p, state);
}

/** What `p` saw on the road in: the good with most unknown sources within 5 tiles of the way from
 * their side's edge to the green; a third of the time they have the way wrong. */
function tell(ctx: SystemContext, p: EntityRow, state: Record<string, number>): void {
  const { world, content } = ctx;
  const g = greenOf(world);
  const edge = edgeSpot(world, content, (p['homeDir'] as string) ?? '');
  if (!edge) return;
  const map = world.map;
  const goods = content.work.scout.goods;
  const counts = goods.map(() => 0);
  const steps = Math.max(Math.abs(edge.x - g.x), Math.abs(edge.y - g.y));
  for (let s = 0; s <= steps; s += 4) {
    const cx = g.x + Math.round(((edge.x - g.x) * s) / Math.max(1, steps));
    const cy = g.y + Math.round(((edge.y - g.y) * s) / Math.max(1, steps));
    for (let y = Math.max(0, cy - 5); y <= Math.min(map.height - 1, cy + 5); y += 1)
      for (let x = Math.max(0, cx - 5); x <= Math.min(map.width - 1, cx + 5); x += 1) {
        const i = y * map.width + x;
        if (map.known[i] === 1) continue;
        goods.forEach((def, k) => (counts[k]! += sourceAt(ctx, def, i) ? 1 : 0));
      }
  }
  // A real seam of an ore the colony wants and knows no seam of, passed within 5 tiles of the
  // road, is told of first (V-215): its word steers the next prospector.
  const ores = seamOres(ctx);
  const wanted = oresWanted(ctx).map((o) => ores.indexOf(o.metal));
  const seen = seamsAlong(ctx, wanted, g, edge);
  const k = seen >= 0 ? goods.length + seen : counts.indexOf(Math.max(...counts));
  if (seen < 0 && !counts[k]) return;
  let [dx, dy] = [edge.x - g.x, edge.y - g.y];
  // Wrong: they mean another way, a quarter, a half or three quarters round.
  const rng = streamFor(world, 'trips');
  if (rng.int(100) < content.work.scout.word.wrong)
    [dx, dy] = rng.pick([
      [-dy, dx],
      [dy, -dx],
      [-dx, -dy],
    ] as const);
  const line = ctx.emit('land.word', {
    causes: [p['arrived'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, find: findOf(ctx, k), dir: compass(dx, dy) },
  });
  Object.assign(state, { good: k + 1, dx, dy, line });
}

/** The words for what word `k` is of: a scouted good's find, or an ore's seam. */
function findOf(ctx: SystemContext, k: number): string {
  const goods = ctx.content.work.scout.goods;
  if (k < goods.length) return goods[k]!.find;
  const id = seamOres(ctx)[k - goods.length]!;
  const f = ctx.content.features.findIndex((d) => d.id === id) + 1;
  return `a ${ctx.content.features[f - 1]!.vein!.seam!} seam of ${oreWord(ctx, f)} in the rock`;
}

/** The first of `wanted` (indices into `seamOres`) with an unfound seam within 5 tiles of the
 * road from `edge` to the green; -1 for none. */
function seamsAlong(
  ctx: SystemContext,
  wanted: readonly number[],
  g: { x: number; y: number },
  edge: { x: number; y: number },
): number {
  if (!wanted.length) return -1;
  const map = ctx.world.map;
  const ores = seamOres(ctx);
  const steps = Math.max(Math.abs(edge.x - g.x), Math.abs(edge.y - g.y));
  for (const i of faceList(map)) {
    const f = seamAt(map, i);
    const k = f ? ores.indexOf(ctx.content.features[f - 1]!.id) : -1;
    if (k < 0 || !wanted.includes(k)) continue;
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    for (let s = 0; s <= steps; s += 1) {
      const cx = g.x + Math.round(((edge.x - g.x) * s) / Math.max(1, steps));
      const cy = g.y + Math.round(((edge.y - g.y) * s) / Math.max(1, steps));
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= 5) return k;
    }
  }
  return -1;
}

/** Whether the way (rx, ry) lies within an eighth turn of the word's. */
export function alongWord(word: Word, rx: number, ry: number): boolean {
  const dot = rx * word.dx + ry * word.dy;
  return dot > 0 && 2 * dot * dot >= (rx * rx + ry * ry) * (word.dx * word.dx + word.dy * word.dy);
}
