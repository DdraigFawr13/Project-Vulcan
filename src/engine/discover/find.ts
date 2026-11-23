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
import { hintsOf, methodDef, puzzlesNow, workedToday } from './tables.ts';

/** `text` with each `{key}` filled from `vars`. */
export const fill = (text: string, vars: Readonly<Record<string, unknown>>): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

const personRow = (ctx: SystemContext, id: number): EntityRow | undefined =>
  (ctx.world.entities['person'] ?? []).find((p) => p.id === id);

/** The puzzle's way. */
export const wayOf = (ctx: SystemContext, puzzle: EntityRow): MethodDef =>
  methodDef(ctx.content, puzzle['method'] as string)!;

/** Others puzzling over the same way who worked its trade today: a hint of a `share` kind
 * reaches them too (Morgan's card 2026-11-23). */
function sharersOf(ctx: SystemContext, puzzle: EntityRow, kind: HintKind, m: MethodDef) {
  if (!ctx.content.methods.share.kinds.includes(kind)) return [];
  const living = new Set(alive(ctx.world).map((p) => p.id));
  return puzzlesNow(ctx.world).filter(
    (q) =>
      q.id !== puzzle.id &&
      q['method'] === puzzle['method'] &&
      living.has(q['person'] as number) &&
      workedToday(ctx, q['person'] as number, m.job),
  );
}

/** A hint of `kind` on `puzzle`, its line citing `causes`, shared with workmates puzzling over
 * the same way; a puzzle's last hint is its find. */
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
  const others = sharersOf(ctx, puzzle, kind, m);
  const mates = others.map((q) => personRow(ctx, q['person'] as number)!);
  const names = list(mates.map((q) => q['name'] as string));
  const beside = mates.length ? fill(content.methods.share.words, { names, ...pronouns(p) }) : '';
  const line = ctx.emit('discover.hint', {
    causes: [...causes, puzzle['line'] as number].filter((l) => l > 0).slice(0, 2),
    actors: [p.id, ...mates.map((q) => q.id)],
    data: {
      ...{ name: p['name'] as string, how: fill(words.how, { ...all, short }), beside },
      ...{ n: hintsOf(world, puzzle.id).length + 1, of: m.hints, method: m.name, kind },
    },
  });
  for (const q of [puzzle, ...others]) {
    if (q['ended']) continue;
    addEntity(world, 'hint', { puzzle: q.id, kind, line, short });
    q['last'] = world.tick;
    if (hintsOf(world, q.id).length >= m.hints)
      findWay(ctx, q, personRow(ctx, q['person'] as number)!, m);
  }
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
