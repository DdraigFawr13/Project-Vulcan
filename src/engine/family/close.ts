// Closeness (P6.1, V-161): each hour two unwed adults at leisure near each other (eating,
// relaxing, warming by a fire, at a supper) grow closer by how well their traits sit together;
// each day every bond fades a little and gains for each tale one told the other that day.
// Nobody is told whom to like (V-041): this is the whole of it.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, alive, far } from '../entity/index.ts';
import { drawnTo } from './drawn.ts';
import { bondOf, bondsOf, unwed } from './tables.ts';

/** Whether two may court: both unwed and grown, and each drawn to the other (drawn.ts). */
export function mayCourt(
  world: WorldState,
  content: EngineContent,
  p: EntityRow,
  q: EntityRow,
): boolean {
  if (!unwed(world, content, p) || !unwed(world, content, q)) return false;
  return drawnTo(content, p, q) && drawnTo(content, q, p);
}

/** Each person's traits, by id. */
const traitsBy = (world: WorldState): Map<number, string[]> => {
  const out = new Map<number, string[]>();
  for (const t of world.entities['trait'] ?? []) {
    const id = t['person'] as number;
    out.set(id, [...(out.get(id) ?? []), t['trait'] as string]);
  }
  return out;
};

/** How many traits two share. */
export function sharedTraits(world: WorldState, p: number, q: number): number {
  const by = traitsBy(world);
  const tq = by.get(q) ?? [];
  return (by.get(p) ?? []).filter((t) => tq.includes(t)).length;
}

/** How well two sit together for an hour: `base`, + `shared` a trait both hold, − `clash` for
 * each trait of one that the other's excludes; never under 0. */
export function likeOf(
  world: WorldState,
  content: EngineContent,
  p: number,
  q: number,
  by: Map<number, string[]> = traitsBy(world),
): number {
  const like = content.family.like;
  const [tp, tq] = [by.get(p) ?? [], by.get(q) ?? []];
  const excludes = (t: string) => content.traits.find((d) => d.id === t)?.excludes ?? [];
  const shared = tp.filter((t) => tq.includes(t)).length;
  const clash =
    tp.filter((t) => excludes(t).some((x) => tq.includes(x))).length +
    tq.filter((t) => excludes(t).some((x) => tp.includes(x))).length;
  return Math.max(0, like.base + shared * like.shared - clash * like.clash);
}

function addClose(world: WorldState, p: number, q: number, by: number): void {
  if (by <= 0) return;
  const r = bondOf(world, p, q);
  if (r) r['close'] = (r['close'] as number) + by;
  else
    addEntity(world, 'bond', {
      ...{ a: Math.min(p, q), b: Math.max(p, q), close: by, state: '', since: 0, line: 0 },
    });
}

/** Each hour: the pairs who may court and are at leisure within `near` tiles grow closer. */
export function hourTogether(world: WorldState, content: EngineContent): void {
  const fam = content.family;
  const here = alive(world).filter((p) => fam.leisure.includes(p['doing'] as string));
  if (here.length < 2) return;
  const by = traitsBy(world);
  for (let i = 0; i < here.length; i += 1)
    for (let j = i + 1; j < here.length; j += 1) {
      const [p, q] = [here[i]!, here[j]!];
      if (far(p, q) > fam.near || !mayCourt(world, content, p, q)) continue;
      addClose(world, p.id, q.id, likeOf(world, content, p.id, q.id, by));
    }
}

/** Each day: every bond fades `fade` per cent (rounded up), then gains `told` for each tale one of
 * them told the other the day before; friends faded to nothing are dropped. */
export function dayTogether(world: WorldState, content: EngineContent): void {
  const fam = content.family;
  const yesterday = Math.floor(world.tick / TICKS_PER_DAY) - 1;
  for (const r of bondsOf(world)) {
    const close = r['close'] as number;
    r['close'] = close - Math.ceil((close * fam.fade) / 100);
  }
  for (const t of (world.entities['tale'] ?? []).filter((x) => x['heard'] === yesterday)) {
    if (!t['teller']) continue;
    const [p, q] = [t['teller'] as number, t['person'] as number];
    const r = bondOf(world, p, q);
    if (r) r['close'] = (r['close'] as number) + fam.told;
  }
  const gone = new Set(
    bondsOf(world)
      .filter((r) => !r['state'] && !r['close'])
      .map((r) => r.id),
  );
  if (gone.size) world.entities['bond'] = bondsOf(world).filter((r) => !gone.has(r.id));
}
