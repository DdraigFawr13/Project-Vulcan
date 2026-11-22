// How rich the valley is (6W Slice 3, V-201): each good draws a share of its usual density once per
// seed, from `generator.riches`, with at least one good rich and one poor, so valleys differ and
// each run asks for something else. Also the green's thinned woods (`start.thin`).
import type { EngineContent, FeatureDef, RngStream } from '../core/index.ts';

/** Draws each good's share by weight, then makes sure one is rich and another poor. */
export function drawRiches(rng: RngStream, content: EngineContent): Record<string, number> {
  const { levels, goods } = content.terrain.generator.riches;
  const drawn = goods.map(() => rng.weighted(levels.map((l, k) => [k, l.weight] as const)));
  const last = levels.length - 1;
  if (!drawn.includes(last)) drawn[rng.int(goods.length)] = last;
  if (!drawn.includes(0)) {
    const others = drawn.flatMap((d, g) => (d === last ? [] : [g]));
    // Every good rich (only with one or two goods): the poor one is drawn among them all.
    drawn[others.length ? rng.pick(others) : rng.int(goods.length)] = 0;
  }
  return Object.fromEntries(goods.map((g, k) => [g.id, levels[drawn[k]!]!.share]));
}

/** The share a feature is placed at: its good's (veins: the `veins` good's), else 1. */
export function shareOf(
  content: EngineContent,
  riches: Readonly<Record<string, number>>,
  def: FeatureDef,
): number {
  const good = content.terrain.generator.riches.goods.find((g) =>
    def.vein ? g.veins : g.yields?.includes(def.yields),
  );
  return good ? (riches[good.id] ?? 1) : 1;
}

/** The arrival line's words: what the valley is rich and poor in ("good berry country, but
 * thin on timber"). */
export function richesWords(
  content: EngineContent,
  riches: Readonly<Record<string, number>>,
): string {
  const { levels, goods } = content.terrain.generator.riches;
  const words = (share: number, key: 'rich' | 'poor'): string[] =>
    goods.flatMap((g) => (riches[g.id] === share ? [g[key]] : []));
  const and = (list: string[]): string =>
    list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
  const rich = and(words(levels.at(-1)!.share, 'rich'));
  const poor = and(words(levels[0]!.share, 'poor'));
  return [rich, poor].filter(Boolean).join(', but ');
}

/** The green keeps at most `start.thin.trees` trees within `thin.reach` of the start, the rest
 * of the valley as drawn: the `start.wood` the green was chosen for are kept from within
 * `start.radius` first, then the rest drawn at random. Returns how many were taken away. */
export function thinNearGreen(
  rng: RngStream,
  content: EngineContent,
  features: number[],
  width: number,
  height: number,
  start: { x: number; y: number },
): number {
  const { thin, radius, wood } = content.terrain.generator.start;
  const inner: number[] = [];
  const outer: number[] = [];
  for (
    let y = Math.max(0, start.y - thin.reach);
    y <= Math.min(height - 1, start.y + thin.reach);
    y += 1
  )
    for (
      let x = Math.max(0, start.x - thin.reach);
      x <= Math.min(width - 1, start.x + thin.reach);
      x += 1
    ) {
      const i = y * width + x;
      const f = features[i]!;
      if (!f || content.features[f - 1]!.kind !== 'tree') continue;
      const d = Math.max(Math.abs(x - start.x), Math.abs(y - start.y));
      (d <= radius ? inner : outer).push(i);
    }
  if (inner.length + outer.length <= thin.trees) return 0;
  const keep = new Set<number>(draw(rng, inner, Math.min(wood, thin.trees)));
  const rest = [...inner.filter((i) => !keep.has(i)), ...outer];
  for (const i of draw(rng, rest, thin.trees - keep.size)) keep.add(i);
  let taken = 0;
  for (const i of [...inner, ...outer])
    if (!keep.has(i)) {
      features[i] = 0;
      taken += 1;
    }
  return taken;
}

/** `n` of `from` drawn without repeats (a partial shuffle of a copy). */
function draw(rng: RngStream, from: readonly number[], n: number): number[] {
  const pool = [...from];
  const count = Math.max(0, Math.min(n, pool.length));
  for (let k = 0; k < count; k += 1) {
    const j = k + rng.int(pool.length - k);
    [pool[k], pool[j]] = [pool[j]!, pool[k]!];
  }
  return pool.slice(0, count);
}
