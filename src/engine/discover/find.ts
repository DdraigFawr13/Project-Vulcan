// Hints and the find (6C Slice 5, V-142, V-218): each hint is a line naming where it came from;
// at the last one the puzzler finds the way, with a line citing every hint, a heavy memory and a
// tale (tales.json `found-way`) that may give a byname. A find ends everyone else's puzzle on it.
import {
  list,
  pronouns,
  TICKS_PER_DAY,
  type EntityRow,
  type HintKind,
  type MethodDef,
} from '../core/index.ts';
import { addEntity, alive } from '../entity/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { hintsOf, methodDef, puzzlesNow } from './tables.ts';

/** `text` with each `{key}` filled from `vars`. */
export const fill = (text: string, vars: Readonly<Record<string, unknown>>): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

const personRow = (ctx: SystemContext, id: number): EntityRow | undefined =>
  (ctx.world.entities['person'] ?? []).find((p) => p.id === id);

/** The puzzle's way. */
export const wayOf = (ctx: SystemContext, puzzle: EntityRow): MethodDef =>
  methodDef(ctx.content, puzzle['method'] as string)!;

/** A hint of `kind` on `puzzle`, its line citing `causes`; the last one is the find. */
export function addHint(
  ctx: SystemContext,
  puzzle: EntityRow,
  kind: HintKind,
  causes: readonly number[],
  vars: Readonly<Record<string, unknown>> = {},
): number {
  const { world, content } = ctx;
  const m = wayOf(ctx, puzzle);
  const p = personRow(ctx, puzzle['person'] as number)!;
  const words = content.methods.kinds[kind];
  const all = { where: m.where, ...vars };
  const short = fill(words.short, all);
  const n = hintsOf(world, puzzle.id).length + 1;
  const line = ctx.emit('discover.hint', {
    causes: [...causes, puzzle['line'] as number].filter((l) => l > 0).slice(0, 2),
    actors: [p.id],
    data: {
      ...{ name: p['name'] as string, how: fill(words.how, { ...all, short }), n, of: m.hints },
      ...{ method: m.name, kind },
    },
  });
  addEntity(world, 'hint', { puzzle: puzzle.id, kind, line, short });
  puzzle['last'] = world.tick;
  if (n >= m.hints) findWay(ctx, puzzle, p, m);
  return line;
}

/** The find: the way is known, the puzzle ends, and so does everyone else's on it. */
function findWay(ctx: SystemContext, puzzle: EntityRow, p: EntityRow, m: MethodDef): void {
  const { world, content } = ctx;
  const hints = hintsOf(world, puzzle.id);
  const line = ctx.emit('discover.found', {
    causes: hints.map((h) => h['line'] as number),
    actors: [p.id],
    data: {
      ...{ name: p['name'] as string, method: m.name, ...pronouns(p) },
      days: Math.max(1, Math.floor((world.tick - (puzzle['since'] as number)) / TICKS_PER_DAY)),
      hints: list(hints.map((h) => h['short'] as string)),
    },
  });
  addEntity(world, 'knows', { person: p.id, method: m.id, how: 'found', line, from: 0 });
  addMemory(ctx, p.id, content.methods.memories.found, line);
  puzzle['ended'] = line;
  const living = new Set(alive(world).map((q) => q.id));
  for (const other of puzzlesNow(world).filter((q) => q['method'] === m.id)) {
    other['ended'] = line;
    const q = personRow(ctx, other['person'] as number);
    if (!q || !living.has(q.id)) continue;
    ctx.emit('discover.beaten', {
      causes: [line],
      actors: [q.id, p.id],
      data: { name: q['name'] as string, method: m.name, finder: p['name'] as string },
    });
  }
}
