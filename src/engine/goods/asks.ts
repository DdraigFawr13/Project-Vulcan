// What the colony is asked for (6C Slice 3, V-225), as goods: the asks table, which goods fit an
// ask and what of them is set apart in the tithe barn. Goods carried in for an ask stop being
// items (as the tithe does), kept as counts by kind on the ask, so nobody eats or works them; a
// hungry or angry colonist may take them from the barn (fromBarn), and the ask is then short.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const ASK_TABLES: Schemas = {
  /** An ask: who it came from (`source` lord, neighbour, guest, faith, ambition) and the asker's
   * name, its words, the tool kind to make or the good wanted (an item kind or good), the least
   * quality, how many, how many are set apart and of which kinds (`held`, "kind=n|kind=n"), the
   * line it came from and its own, the tick it is due by (0: the lord's next visit), its state
   * (open, taken, passed, done, late), the colony's priority 1 to 4 and the line that set it, who
   * is on the way to carry some, and the line that settled it. */
  ask: {
    ...{ source: 'text', asker: 'text', what: 'text', tool: 'text', good: 'text' },
    ...{ quality: 'text', count: 'count', got: 'count', held: 'text', cite: 'event' },
    ...{ line: 'event', due: 'int', state: 'text', level: 'count', answer: 'event' },
    ...{ going: 'ints', settled: 'event' },
  },
};

export const asksOf = (world: WorldState): EntityRow[] => world.entities['ask'] ?? [];

/** Asks not yet settled: open (unanswered), taken up, or let pass and waiting for their day. */
export const liveAsks = (world: WorldState): EntityRow[] =>
  asksOf(world).filter((a) => ['open', 'taken', 'passed'].includes(a['state'] as string));

/** Taken-up asks still short of what they want, by priority then age. */
export const takenAsks = (world: WorldState): EntityRow[] =>
  asksOf(world)
    .filter((a) => a['state'] === 'taken' && (a['got'] as number) < (a['count'] as number))
    .sort((a, b) => (a['level'] as number) - (b['level'] as number) || a.id - b.id);

/** How many more an ask wants. */
export const stillWanted = (a: EntityRow): number =>
  Math.max(0, (a['count'] as number) - (a['got'] as number));

/** Steps of a quality word, best first (the furniture words). */
const rank = (content: EngineContent, word: string): number =>
  content.buildings.furniture.quality.findIndex((q) => q.id === word);

/** Whether item `i` is what ask `a` wants: a tool of its kind at least as good, else goods of its
 * kind or good. */
export function fitsAsk(content: EngineContent, a: EntityRow, i: EntityRow): boolean {
  const def = content.items.find((d) => d.id === i['kind']);
  if (!def) return false;
  if (a['tool']) {
    if (def.tool?.kind !== a['tool']) return false;
    const want = a['quality'] as string;
    return !want || rank(content, (i['quality'] as string) || 'plain') <= rank(content, want);
  }
  return def.id === a['good'] || def.good === a['good'];
}

/** What an ask holds in the barn, kind by kind. */
export function heldOf(a: EntityRow): Map<string, number> {
  const out = new Map<string, number>();
  for (const part of String(a['held'] || '').split('|')) {
    const [kind, n] = part.split('=');
    if (kind && Number(n) > 0) out.set(kind, Number(n));
  }
  return out;
}

function setHeld(a: EntityRow, held: Map<string, number>): void {
  a['held'] = [...held]
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}=${n}`)
    .join('|');
  a['got'] = [...held.values()].reduce((s, n) => s + n, 0);
}

/** `n` of `kind` carried into the barn for ask `a`. */
export function setApart(a: EntityRow, kind: string, n: number): void {
  const held = heldOf(a);
  held.set(kind, (held.get(kind) ?? 0) + n);
  setHeld(a, held);
}

/** What every live ask holds in the barn, kind by kind. */
export function apartOf(world: WorldState): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of liveAsks(world))
    for (const [k, n] of heldOf(a)) out.set(k, (out.get(k) ?? 0) + n);
  return out;
}

/** Takes up to `count` of `kind` from what live asks hold (the newest ask first); how many. */
export function fromAsks(world: WorldState, kind: string, count: number): number {
  let left = count;
  for (const a of [...liveAsks(world)].reverse()) {
    const held = heldOf(a);
    const n = Math.min(left, held.get(kind) ?? 0);
    if (!n) continue;
    held.set(kind, (held.get(kind) ?? 0) - n);
    setHeld(a, held);
    left -= n;
    if (!left) break;
  }
  return count - left;
}

/** Empties ask `a`'s share of the barn (handed over, or the ask is over). */
export const emptyAsk = (a: EntityRow): void => setHeld(a, new Map());

/** An `ask` load put down short of the barn: the goods are the colony's again and whoever was
 * carrying it is no longer on the way. */
export function dropAsk(world: WorldState, load: EntityRow): void {
  if (load['state'] !== 'ask') return;
  for (const a of asksOf(world))
    if ((a['going'] as number[]).includes(load['holder'] as number)) a['going'] = [];
  load['state'] = '';
}
