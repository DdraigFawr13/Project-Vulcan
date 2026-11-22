// Taking a calling (6B Bundle 6, V-189 q8): every `every` days at `hour`, each calling with no
// living holder goes to the grown-up who passes every test of its first stage's bar and ranks
// highest on its `best` test (ties to the lower id), one calling a person. The line says why,
// citing what lay behind it; it is held for life, then passed on the same way.
import type { CallingDef, EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, alive } from '../entity/index.ts';
import { grown } from '../family/index.ts';
import { findEvent } from '../log/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { byTrust, measure, type Measure, type Seen } from './bar.ts';
import { callingsOf } from './tables.ts';

const MOST_CAUSES = 3;

/** "a, b and c". */
const joined = (words: string[]): string =>
  words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)!}`;

/** Holders who died or left give their calling up (no line: their going is one). */
function release(ctx: SystemContext): void {
  const living = new Set(alive(ctx.world).map((p) => p.id));
  for (const row of callingsOf(ctx.world))
    if (!row['ended'] && !living.has(row['person'] as number)) row['ended'] = ctx.world.tick;
}

/** The best who passes `def`'s bar, with their measures. */
function bestFor(s: Seen, def: CallingDef, free: EntityRow[]) {
  const bar = def.stages[0]?.bar ?? [];
  return free
    .map((p) => ({ p, m: bar.map((t) => measure(s, p, t)) }))
    .filter((c) => c.m.length && c.m.every((m) => m.pass))
    .sort(
      (a, b) => (b.m[def.best]?.score ?? 0) - (a.m[def.best]?.score ?? 0) || a.p.id - b.p.id,
    )[0];
}

/** The lines behind it that the ledger still holds, else the line they came in on. */
function causesOf(ctx: SystemContext, p: EntityRow, m: Measure[]): number[] {
  const { world } = ctx;
  const known = (id: number) => !!(findEvent(world.log, id) ?? findEvent(world.stubs, id));
  const cites = [...new Set(m.map((x) => x.cite).filter((c) => c > 0 && known(c)))];
  return cites.length ? cites.slice(0, MOST_CAUSES) : [p['arrived'] as number];
}

function take(ctx: SystemContext, def: CallingDef, p: EntityRow, m: Measure[]): void {
  const skill = m[def.best]?.skill || m.find((x) => x.skill)?.skill || '';
  const title = def.titles?.[skill] ?? def.name;
  const line = ctx.emit('calling.taken', {
    causes: causesOf(ctx, p, m),
    actors: [p.id],
    data: { name: p['name'] as string, title, why: joined(m.map((x) => x.word).filter(Boolean)) },
  });
  addEntity(ctx.world, 'calling', {
    ...{ person: p.id, calling: def.id, stage: def.stages[0]!.id, skill, title },
    ...{ line, since: ctx.world.tick, ended: 0, work: 0, named: '' },
  });
}

/** The day's look: callings given up, and each open one to the best who passes. */
export function callingDay(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  release(ctx);
  const held = new Set(
    callingsOf(world)
      .filter((r) => !r['ended'])
      .map((r) => r['person']),
  );
  const s: Seen = { world, content, state, trust: byTrust(world, content) };
  for (const def of content.callings.callings) {
    if (callingsOf(world).some((r) => !r['ended'] && r['calling'] === def.id)) continue;
    const free = alive(world).filter((p) => !held.has(p.id) && grown(world, content, p));
    const best = bestFor(s, def, free);
    if (!best) continue;
    take(ctx, def, best.p, best.m);
    held.add(best.p.id);
  }
}

/** How `person` stands against every calling's first bar now (tests and `npm run callings`). */
export function barsOf(world: WorldState, content: EngineContent, person: number) {
  const s: Seen = {
    ...{ world, content, state: world.systems['calling'] ?? {} },
    trust: byTrust(world, content),
  };
  const p = alive(world).find((q) => q.id === person);
  return content.callings.callings.map((def) => ({
    calling: def.id,
    measures: p ? (def.stages[0]?.bar ?? []).map((t) => measure(s, p, t)) : [],
  }));
}
