// Each person's faith (6B Bundle 4, P6.8, V-187): everyone holds the faith of their home people
// (cultures.json `religion`), with a devotion 0 to 10 from that people's `faith` value, a seeded
// nudge of up to `devotion.spread` either way, and `devotion.devout` more for the devout trait. A
// child takes their mother's people, so their faith. The faith's record (a creed) is copied from
// content the first time someone holds it. Nobody changes faith yet.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { creedsOf, faithOf, shrineKindOf } from './tables.ts';

/** The creed row for faith `faith` (named `name`), made the first time it is held. */
function creedFor(world: WorldState, content: EngineContent, faith: string, name: string): number {
  const had = creedsOf(world).find((c) => c['faith'] === faith);
  if (had) return had.id;
  const def = content.faiths.defs.find((d) => d.id === faith);
  return addEntity(world, 'creed', {
    ...{ faith, name, title: def?.priestTitle ?? 'priest', kind: shrineKindOf(content, faith) },
    ...{ shrine: 0, line: 0, priest: 0, named: 0 },
  });
}

/** A new holder's devotion: their people's faith value, the nudge, and the devout trait. */
function devotionOf(ctx: SystemContext, p: EntityRow, base: number): number {
  const { world, content } = ctx;
  const d = content.worship.devotion;
  const devout = (world.entities['trait'] ?? []).some(
    (t) => t['person'] === p.id && t['trait'] === d.trait,
  );
  const n = base + ctx.rng().between(-d.spread, d.spread) + (devout ? d.devout : 0);
  return Math.max(0, Math.min(10, n));
}

/** Each hour: everyone alive with no faith yet takes their people's, in id order. */
export function believeHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  for (const p of world.entities['person'] ?? []) {
    if (p['status'] !== 'alive' || faithOf(world, p.id)) continue;
    const culture = content.cultures.find((c) => c.id === p['culture']);
    if (!culture) continue;
    const creed = creedFor(world, content, culture.religion.id, culture.religion.name);
    addEntity(world, 'faithful', {
      ...{ person: p.id, creed, devotion: devotionOf(ctx, p, culture.values['faith'] ?? 0) },
      ...{ prayed: 0, until: 0 },
    });
  }
}
