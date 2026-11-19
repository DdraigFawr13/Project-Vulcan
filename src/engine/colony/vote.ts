// The elder's vote (P6.6, V-173 change from Morgan's form): each villager looks to the one they
// trust most, through their own eyes. On top of the trust everyone sees (`trustOf`), a villager
// leans towards a friend or housemate, towards someone who shares their traits, and, in a plight
// (hungry, thirsty, cold, hurt or frightened), towards whoever holds the role that plight calls
// for. The sitting elder keeps a boost unless standing has fallen `vote.fallen` points since they
// took over. All the numbers are content (colony.json `elder.vote`).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { openWounds } from '../health/index.ts';
import { memoriesOf, needOf } from '../needs/index.ts';
import { rolesOf } from '../self/index.ts';

/** The plights a villager is in now, by name (colony.json `elder.vote.plights` keys). */
function plightsOf(world: WorldState, content: EngineContent, voter: number): string[] {
  const v = content.colony.elder.vote;
  const out: string[] = [];
  for (const need of Object.keys(v.plights))
    if (needOf(world, voter, need)?.['low']) out.push(need);
  if (openWounds(world, voter).length) out.push('hurt');
  if (memoriesOf(world, voter).some((m) => v.afraid.includes(m['memory'] as string)))
    out.push('afraid');
  return out.filter((p) => v.plights[p]);
}

const traitsOf = (world: WorldState, p: number): Set<string> =>
  new Set(
    (world.entities['trait'] ?? [])
      .filter((t) => t['person'] === p)
      .map((t) => t['trait'] as string),
  );

export interface Candidate {
  p: EntityRow;
  trust: number;
}

/** How much `voter` trusts `c`, through their own nature and plight. */
export function trustBy(
  world: WorldState,
  content: EngineContent,
  voter: EntityRow,
  c: Candidate,
  near: Set<number>,
  boost: number,
): number {
  const v = content.colony.elder.vote;
  const mine = traitsOf(world, voter.id);
  const shared = [...traitsOf(world, c.p.id)].filter((t) => mine.has(t)).length;
  const roles = new Set(rolesOf(world, c.p.id).map((r) => r['role'] as string));
  const plight = plightsOf(world, content, voter.id).filter((x) => roles.has(v.plights[x]!));
  return (
    c.trust +
    (near.has(c.p.id) ? v.friend : 0) +
    shared * v.shared +
    plight.length * v.plight +
    boost
  );
}

/** Each voter's pick among `cands` (never themself), tallied; ties go to trust, then the
 * lower id. `nearOf` gives a voter's friends and housemates; `boostOf` a candidate's boost. */
export function tally(
  world: WorldState,
  content: EngineContent,
  voters: EntityRow[],
  cands: Candidate[],
  nearOf: (p: EntityRow) => Set<number>,
  boostOf: (c: Candidate) => number,
): Map<number, number> {
  const votes = new Map<number, number>();
  for (const voter of voters) {
    const near = nearOf(voter);
    let best: { c: Candidate; by: number } | undefined;
    for (const c of cands) {
      if (c.p.id === voter.id) continue;
      const by = trustBy(world, content, voter, c, near, boostOf(c));
      const ahead =
        !best ||
        by > best.by ||
        (by === best.by &&
          (c.trust > best.c.trust || (c.trust === best.c.trust && c.p.id < best.c.p.id)));
      if (ahead) best = { c, by };
    }
    if (best) votes.set(best.c.p.id, (votes.get(best.c.p.id) ?? 0) + 1);
  }
  return votes;
}
