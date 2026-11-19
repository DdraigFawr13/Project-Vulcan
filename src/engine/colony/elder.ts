// The elder (P6.6, proposal P1, V-158): the most trusted colonist, worked out every `every` days.
// Trust comes from being of the founding band, traits, the roles they hold, how many have heard a
// tale from them lately and how many laws they keep. Held, an elder gives way only to someone
// `margin` more trusted. Their friends (those they told a tale or heard one from in `friendDays`,
// and those they share a house with) lean their way on every law (law `weigh.ts`). An elder's
// death shakes standing for a season.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { homeHouse } from '../health/index.ts';
import { rolesOf } from '../self/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addCause } from './standing.ts';
import { colonyRow, elderOf } from './tables.ts';

const alive = (world: WorldState): EntityRow[] =>
  (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** Everyone `p` told a tale or heard one from since `day`. */
function talkedWith(world: WorldState, p: number, day: number): Set<number> {
  const out = new Set<number>();
  for (const t of world.entities['tale'] ?? []) {
    if ((t['day'] as number) < day) continue;
    if (t['teller'] === p) out.add(t['person'] as number);
    else if (t['person'] === p && t['teller']) out.add(t['teller'] as number);
  }
  out.delete(p);
  return out;
}

/** `p`'s trust and the words for its two biggest parts. */
export function trustOf(
  world: WorldState,
  content: EngineContent,
  p: EntityRow,
): { trust: number; why: string[] } {
  const e = content.colony.elder;
  const parts: [number, string][] = [];
  if (!p['stranger']) parts.push([e.founder, 'one of the founding band']);
  for (const t of world.entities['trait'] ?? [])
    if (t['person'] === p.id && e.traits[t['trait'] as string]) {
      const name = content.traits.find((d) => d.id === t['trait'])?.name ?? (t['trait'] as string);
      parts.push([e.traits[t['trait'] as string]!, name.toLowerCase()]);
    }
  for (const r of rolesOf(world, p.id)) {
    const by = e.roles[r['role'] as string] ?? 0;
    const name = content.self.roles.find((d) => d.id === r['role'])?.name ?? '';
    if (by) parts.push([by, `seen as ${name}`]);
  }
  const day = Math.floor(world.tick / TICKS_PER_DAY) - e.friendDays;
  const heard = [...talkedWith(world, p.id, day)].filter((q) =>
    (world.entities['tale'] ?? []).some(
      (t) => t['teller'] === p.id && t['person'] === q && (t['day'] as number) >= day,
    ),
  ).length;
  const listened = Math.min(e.listeners, heard) * e.listener;
  if (listened) parts.push([listened, `listened to by ${heard}`]);
  const keeps = (world.entities['answer'] ?? []).filter(
    (a) => a['person'] === p.id && a['answer'] === 'obeys',
  ).length;
  if (keeps * e.keeps) parts.push([keeps * e.keeps, 'keeps the laws']);
  const trust = parts.reduce((n, [by]) => n + by, 0);
  const why = parts
    .filter(([by]) => by > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 2)
    .map(([, w]) => w);
  return { trust, why };
}

/** The elder's friends: those they talked with in `friendDays`, and their housemates. */
export function friendsOf(ctx: SystemContext, elder: EntityRow): number[] {
  const { world, content } = ctx;
  const day = Math.floor(world.tick / TICKS_PER_DAY) - content.colony.elder.friendDays;
  const out = talkedWith(world, elder.id, day);
  const home = homeHouse(world, content, elder);
  if (home) for (const q of alive(world)) if (homeHouse(world, content, q) === home) out.add(q.id);
  out.delete(elder.id);
  return [...out].filter((q) => alive(world).some((p) => p.id === q)).sort((a, b) => a - b);
}

/** Works out who the elder is; a new one is a line. */
export function pickElder(ctx: SystemContext): void {
  const { world, content } = ctx;
  const e = content.colony.elder;
  const row = colonyRow(world)!;
  const held = elderOf(world);
  const scored = alive(world)
    .map((p) => ({ p, ...trustOf(world, content, p) }))
    .map((s) => ({ ...s, score: s.trust + (s.p.id === held ? e.margin : 0) }))
    .sort((a, b) => b.score - a.score || a.p.id - b.p.id);
  const [best, next] = scored;
  const firm =
    best &&
    best.trust >= e.least &&
    (!next || best.score >= next.score + (best.p.id === held ? 0 : e.margin));
  if (best && firm && best.p.id !== held) {
    row['elder'] = best.p.id;
    row['line'] = ctx.emit('colony.elder', {
      actors: [best.p.id],
      data: { name: best.p['name'] as string, why: best.why.join(' and ') || 'trusted' },
    });
  }
  const elder = alive(world).find((p) => p.id === row['elder']);
  row['friends'] = elder ? friendsOf(ctx, elder) : [];
}

/** An elder who died: standing is shaken for a season, and nobody is elder until the next pick. */
export function elderGone(ctx: SystemContext): void {
  const { world, content } = ctx;
  const row = colonyRow(world);
  const id = elderOf(world);
  if (!row || !id) return;
  const p = (world.entities['person'] ?? []).find((q) => q.id === id);
  if (p && p['status'] === 'alive') return;
  row['elder'] = 0;
  row['friends'] = [];
  if (!p || p['status'] !== 'dead') return;
  const d = content.colony.standing.elderDied;
  const died = (world.entities['body'] ?? []).find((h) => h['person'] === id)?.['died'];
  const text = d.text.replace('{name}', p['name'] as string);
  addCause(
    ctx,
    'elderDied',
    d,
    text,
    typeof died === 'number' && died ? [died] : [row['line'] as number],
  );
}
