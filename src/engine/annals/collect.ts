// Keeping the season's lines (V-191): once a day the annals read the ledger lines written before
// this tick and keep each one a recap tells (importance 3, or notable, and not skipped) with its
// words, so the recap outlives the sealed days. The season line that opens a span is noted, so a
// recap's numbers cite it.
import { clockAt, type AnnalLineDef, type EngineContent, type SimEvent } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { notableOf, type Notable } from '../log/index.ts';
import type { SystemContext } from '../sim/index.ts';

interface Kept {
  important: Set<string>;
  notable: Notable;
  skip: Set<string>;
}
const kept = new WeakMap<EngineContent, Kept>();

function keptOf(content: EngineContent): Kept {
  let k = kept.get(content);
  if (!k) {
    k = {
      important: new Set(content.events.filter((e) => e.importance === 3).map((e) => e.id)),
      notable: notableOf(content.events),
      skip: new Set(content.annals.skip),
    };
    kept.set(content, k);
  }
  return k;
}

/** Whether a recap tells line `e`. */
export function isKept(content: EngineContent, e: Pick<SimEvent, 'type' | 'data'>): boolean {
  const k = keptOf(content);
  return !k.skip.has(e.type) && (k.important.has(e.type) || k.notable(e));
}

/** The section and line entry that tell a line of `type` with `data`, or undefined. */
export function entryOf(
  content: EngineContent,
  type: string,
  data: Readonly<Record<string, unknown>>,
): { section: number; line: number; def: AnnalLineDef } | undefined {
  const { sections } = content.annals;
  for (let s = 0; s < sections.length; s += 1)
    for (let l = 0; l < sections[s]!.lines.length; l += 1) {
      const def = sections[s]!.lines[l]!;
      if (def.event !== type) continue;
      if (Object.entries(def.only ?? {}).every(([k, v]) => String(data[k] ?? '') === v))
        return { section: s, line: l, def };
    }
  return undefined;
}

/** Keeps the lines after `seen` written before this tick, oldest first. */
export function collect(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const { log } = world;
  let k = log.length;
  const seen = state['seen'] ?? 0;
  while (k > 0 && log[k - 1]!.id > seen) k -= 1;
  for (; k < log.length; k += 1) {
    const e = log[k]!;
    if (e.tick >= world.tick) break;
    state['seen'] = e.id;
    const clock = clockAt(e.tick, content.calendar);
    if (e.type === 'calendar.season') {
      state['opened'] = e.id;
      if (clock.season === 0) state['yearOpened'] = e.id;
    }
    if (!isKept(content, e) || !entryOf(content, e.type, e.data)) continue;
    addEntity(world, 'annalLine', {
      event: e.id,
      type: e.type,
      words: JSON.stringify(e.data),
      actors: [...e.actors],
      year: clock.year,
      season: clock.season,
    });
  }
}
