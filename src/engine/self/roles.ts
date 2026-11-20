// Roles (P6.4, V-156): each day at self.json `hour` everyone's roles are worked out from points:
// their traits, the heavy and lasting memories they hold (a light one is a passing mood, not who
// they are), a point for each
// `skillStep` levels of the best listed skill, having come as a newcomer, refusing a law now, and
// the beliefs they hold at strength 2 or more. Roles from `at` points are held, at most `most`; a held
// role stays while it has `at` and no unheld one beats it by `keep`. A change is a line citing
// the memory that weighed most for a new role (else the line they came in on).
import type { EngineContent, EntityRow, RoleDef, WorldState } from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { bandOf, heldMemoriesOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { rolesOf } from './tables.ts';
import { lower } from '../core/index.ts';

interface Score {
  role: RoleDef;
  points: number;
  /** What gave the most points, in words, and the memory line behind them (0 for none). */
  why: string;
  cite: number;
}

/** Ids in a fixed order, without locale rules (engine purity). */
const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The first band's arrival line: anyone who came on a later one is a newcomer. */
const firstArrival = (world: WorldState): number =>
  Math.min(...(world.entities['person'] ?? []).map((p) => p['arrived'] as number));

/** How `p` scores on every role, strongest first. */
export function scoresOf(world: WorldState, content: EngineContent, p: EntityRow): Score[] {
  const dial = content.self;
  const traits = (world.entities['trait'] ?? []).filter((t) => t['person'] === p.id);
  const skills = (world.entities['skill'] ?? []).filter((s) => s['person'] === p.id);
  const held = heldMemoriesOf(world, p.id);
  const beliefs = (world.entities['belief'] ?? []).filter((b) => b['person'] === p.id);
  const refuses = (world.entities['answer'] ?? []).some(
    (a) => a['person'] === p.id && a['answer'] === 'refuses',
  );
  const newcomer = (p['arrived'] as number) > firstArrival(world);
  return dial.roles
    .map((role) => {
      const parts: { by: number; word: string; line: number }[] = [];
      for (const t of traits) {
        const by = role.traits[t['trait'] as string] ?? 0;
        const name = content.traits.find((d) => d.id === t['trait'])?.name ?? '';
        if (by) parts.push({ by, word: lower(name), line: 0 });
      }
      for (const m of held) {
        const id = m['memory'] as string;
        const base = role.memories[id] ?? 0;
        if (!base) continue;
        if (bandOf(content, m['weight'] as number) === 'light') continue;
        const text = content.memories.find((d) => d.id === id)?.text ?? id;
        parts.push({ by: base, word: lower(text), line: m['line'] as number });
      }
      const best = skills
        .filter((s) => role.skills?.includes(s['skill'] as string))
        .sort((a, b) => (b['level'] as number) - (a['level'] as number))[0];
      const bySkill = best ? Math.floor((best['level'] as number) / dial.skillStep) : 0;
      if (best && bySkill) {
        const name = content.abilities.find((a) => a.id === best['skill'])?.name ?? '';
        parts.push({ by: bySkill, word: `good at ${name.toLowerCase()}`, line: 0 });
      }
      if (newcomer && role.newcomer)
        parts.push({ by: role.newcomer, word: 'came from elsewhere', line: 0 });
      if (refuses && role.refused) parts.push({ by: role.refused, word: 'refuses a law', line: 0 });
      for (const b of beliefs) {
        // Only a belief they hold at least as "Thinks" (strength 2) shapes who they are.
        const by =
          (b['strength'] as number) >= 2 ? (role.beliefs?.[b['belief'] as string] ?? 0) : 0;
        const text = content.tales.beliefs.find((d) => d.id === b['belief'])?.text ?? '';
        if (by) parts.push({ by, word: `believes ${text}`, line: b['line'] as number });
      }
      const points = parts.reduce((s, x) => s + x.by, 0);
      const top = parts.filter((x) => x.by > 0).sort((a, b) => b.by - a.by);
      const cite = top.find((x) => x.line)?.line ?? 0;
      return {
        role,
        points,
        why: top
          .slice(0, 2)
          .map((x) => x.word)
          .join(' and '),
        cite,
      };
    })
    .sort((a, b) => b.points - a.points || byId(a.role.id, b.role.id));
}

/** The roles `p` should hold now: from `at` points, a held one counting `keep` more, at most
 * `most`. */
function chosen(content: EngineContent, scores: Score[], held: Set<string>): Score[] {
  const { at, most, keep } = content.self;
  const rank = (s: Score) => s.points + (held.has(s.role.id) ? keep : 0);
  return scores
    .filter((s) => s.points >= at)
    .sort((a, b) => rank(b) - rank(a) || byId(a.role.id, b.role.id))
    .slice(0, most);
}

/** Works out `p`'s roles; `quiet` (the first day) writes no line. */
export function settleRoles(ctx: SystemContext, p: EntityRow, quiet: boolean): void {
  const { world, content } = ctx;
  const rows = rolesOf(world, p.id);
  const held = new Set(rows.map((r) => r['role'] as string));
  const now = chosen(content, scoresOf(world, content, p), held);
  for (const s of now) {
    const row = rows.find((r) => r['role'] === s.role.id);
    if (row) Object.assign(row, { points: s.points, why: s.why });
  }
  const gained = now.filter((s) => !held.has(s.role.id));
  const lost = rows.filter((r) => !now.some((s) => s.role.id === r['role']));
  if (!gained.length && !lost.length) return;
  for (const r of lost) removeEntity(world, 'role', r.id);
  const name = (id: string) => content.self.roles.find((d) => d.id === id)?.name ?? id;
  const line = quiet
    ? (p['arrived'] as number)
    : ctx.emit('self.role', {
        causes: [gained.find((g) => g.cite)?.cite || (p['arrived'] as number)],
        actors: [p.id],
        data: {
          name: p['name'] as string,
          roles: now.map((s) => s.role.name).join(' and ') || 'no one in particular',
          was: lost.length
            ? `, no longer ${lost.map((r) => name(r['role'] as string)).join(' or ')}`
            : '',
          why: gained.length ? `: ${gained[0]!.why}` : '',
        },
      });
  for (const s of gained)
    addEntity(world, 'role', {
      person: p.id,
      role: s.role.id,
      points: s.points,
      why: s.why,
      line,
      since: world.tick,
    });
}
