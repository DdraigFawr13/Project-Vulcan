// The elder (P6.6, proposal P1, V-158, V-173): every `every` days each villager looks to the one
// they trust most (`vote.ts`), and whoever most look to, with `vote.least` at least and nobody
// level, is elder. Trust everyone sees comes from being of the founding band, traits, the roles
// they hold, how many have heard a tale from them lately and how many laws they keep. Their friends (those they told a tale or heard one from in `friendDays`,
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
import { colonyRow, elderOf, standingOf } from './tables.ts';
import { tally, type Candidate } from './vote.ts';

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

/** `p`'s friends: those they talked with in `friendDays`, and their housemates. */
function nearOf(world: WorldState, content: EngineContent, p: EntityRow): number[] {
  const day = Math.floor(world.tick / TICKS_PER_DAY) - content.colony.elder.friendDays;
  const out = talkedWith(world, p.id, day);
  const home = homeHouse(world, content, p);
  const people = alive(world);
  if (home) for (const q of people) if (homeHouse(world, content, q) === home) out.add(q.id);
  out.delete(p.id);
  return [...out].filter((q) => people.some((x) => x.id === q)).sort((a, b) => a - b);
}

/** The elder's friends, who lean their way on every law. */
export const friendsOf = (ctx: SystemContext, elder: EntityRow): number[] =>
  nearOf(ctx.world, ctx.content, elder);

/** The words for why they were chosen: how many look to them, their trust, and a fallen elder. */
function whyWords(
  content: EngineContent,
  best: Candidate & { votes: number; why: string[] },
  people: number,
  fallen: string,
): string {
  const v = content.colony.elder.vote;
  const looks = v.looks.replace('{votes}', String(best.votes)).replace('{people}', String(people));
  const trust = best.why.length ? `, ${best.why.join(' and ')}` : '';
  return `${looks}${trust}${fallen ? `; ${v.fallen.replace('{name}', fallen)}` : ''}`;
}

/** Works out who the elder is by everyone's vote; a new one is a line. */
export function pickElder(ctx: SystemContext): void {
  const { world, content } = ctx;
  const e = content.colony.elder;
  const row = colonyRow(world)!;
  const held = elderOf(world);
  const people = alive(world);
  const standing = standingOf(world, content);
  const fell =
    !!held && ((row['took'] as number | undefined) ?? standing) - standing >= e.vote.drop;
  const cands = people
    .map((p) => ({ p, ...trustOf(world, content, p) }))
    .filter((c) => c.trust >= e.least);
  const near = (p: EntityRow) => new Set(nearOf(world, content, p));
  const boost = (c: Candidate) => (c.p.id === held && !fell ? e.vote.incumbent : 0);
  const votes = tally(world, content, people, cands, near, boost);
  const ranked = cands
    .map((c) => ({ ...c, votes: votes.get(c.p.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes || b.trust - a.trust || a.p.id - b.p.id);
  const [best, next] = ranked;
  const firm = best && best.votes >= e.vote.least && (!next || best.votes > next.votes);
  if (best && firm && best.p.id !== held) {
    const was = people.find((p) => p.id === held);
    const why = whyWords(content, best, people.length, fell && was ? (was['name'] as string) : '');
    row['elder'] = best.p.id;
    row['took'] = standing;
    row['why'] = why;
    row['line'] = ctx.emit('colony.elder', {
      actors: [best.p.id],
      data: { name: best.p['name'] as string, why },
    });
  }
  const elder = people.find((p) => p.id === row['elder']);
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
