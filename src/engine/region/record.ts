// The region's record of each neighbour (P5.9, V-028): what its last `strangers.years` years in
// the Story Generator world give someone to leave for, by reason kind (strangers.json `reasons`):
// hunger, sickness, a feud, war, a people on the move. Each kind keeps its most telling event
// (the most important, then the latest) in the package's own words. Pure; draws no randomness.
import type { EngineContent } from '../core/index.ts';
import { narrator, storyWorld, type WorldState } from './story.ts';
import { siteOf, valleyOf } from './system.ts';

export interface Reason {
  kind: string;
  /** The record's line for it, in the Story Generator's words. */
  line: string;
}

export interface Neighbour {
  name: string;
  /** Culture id. */
  culture: string;
  days: number;
  dir: string;
  /** The site's kind in the world: hamlet, village, town, city, fortress, hold, mine, temple, port. */
  kind: string;
  /** Its reasons, in content `kinds` order; none for a quiet place. */
  reasons: Reason[];
}

const kept = new WeakMap<WorldState, Map<string, Neighbour[]>>();

/** The valley's neighbours with their recent record, or none for a plain seed. */
export function neighboursOf(seed: string, content: EngineContent): Neighbour[] {
  const found = valleyOf(seed, content);
  if (!found) return [];
  const world = storyWorld(siteOf(seed)!.region, content);
  const cache = kept.get(world) ?? new Map<string, Neighbour[]>();
  kept.set(world, cache);
  const known = cache.get(seed);
  if (known) return known;
  const def = content.strangers;
  const last = world.events.reduce((m, e) => Math.max(m, e.day), 0);
  const since = last - Math.floor((last * def.years) / content.region.world.years);
  const told = narrator(world, content);
  const sites = [...world.sites.values()];
  const out = found.valley.near.flatMap((n) => {
    const culture = content.cultures.find((c) => c.name === n.culture || c.id === n.culture);
    if (!culture) return [];
    const cell = sites.find((s) => s.name === n.name)?.cell;
    const best = new Map<string, (typeof world.events)[number]>();
    for (const e of world.events) {
      const kind = def.reasons[e.type];
      if (cell === undefined || e.place !== cell || e.day < since || !kind) continue;
      const b = best.get(kind);
      if (!b || e.importance > b.importance || (e.importance === b.importance && e.day > b.day))
        best.set(kind, e);
    }
    const reasons = def.kinds
      .filter((k) => best.has(k.id))
      .map((k) => ({ kind: k.id, line: told.renderEvent(best.get(k.id)!) }));
    return [{ name: n.name, culture: culture.id, days: n.days, dir: n.dir, kind: n.kind, reasons }];
  });
  cache.set(seed, out);
  return out;
}
