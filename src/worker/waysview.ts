// New ways on screen (6C Slice 6, V-221): what a person is puzzling over and its hints, each way
// they know (how they came by it, when, and what it does for their work), and the colony's list
// under the New Ways law (each way with who knows it, a warning when only one does, then what is
// being puzzled over). A pure read of the discovery tables; a way nobody has found is never shown.
import { content } from '../content/index.ts';
import {
  alive,
  clockAt,
  hintsOf,
  knowersOf,
  knowsOf,
  list,
  methodDef,
  personOf,
  puzzleOf,
  recordOf,
  type EntityRow,
  type MethodsScreen,
  type WorldState,
} from '../engine/index.ts';
import type { ColonyWaysView, PersonWaysView, WayRow } from './protocol-people.ts';

const words = () => content.methods.screen;
const fill = (t: string, vars: Readonly<Record<string, string | number>>): string =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const nameOf = (world: WorldState, id: unknown): string =>
  (personOf(world, id)?.['name'] as string | undefined) ?? 'someone';

/** "Day 3 of Leaffall, year 2", the day of a line (a sealed one's stub keeps its tick). */
function dateOf(world: WorldState, line: number): string {
  const c = clockAt(recordOf(world, line)?.tick ?? 0, content.calendar);
  return `Day ${c.day} of ${content.calendar.monthNames[c.month]!}, year ${c.year}`;
}

/** `line` when it explains more than the world's beginning (its why? opens a chain), else none. */
function whyOf(world: WorldState, line: number): { why?: number } {
  const r = recordOf(world, line);
  return r && 'causes' in r && r.causes.some((c) => c !== world.begunEvent) ? { why: line } : {};
}

/** What a way does for a knower's work, in words. */
const effectOf = (method: string): string => words().effects[method] ?? '';

/** The way `p` is puzzling over, with each hint and the line it came on. */
function puzzleView(world: WorldState, p: EntityRow): PersonWaysView['puzzle'] {
  const puzzle = puzzleOf(world, p.id);
  const m = puzzle && methodDef(content, puzzle['method'] as string);
  if (!puzzle || !m) return undefined;
  const hints = hintsOf(world, puzzle.id);
  const left = m.hints - hints.length;
  return {
    text: fill(words().puzzle, { method: m.name, n: hints.length, of: m.hints }),
    ...whyOf(world, puzzle['line'] as number),
    hints: hints.map((h, k) => ({
      text: fill(words().hint, { n: k + 1, short: h['short'] as string }),
      ...whyOf(world, h['line'] as number),
    })),
    left: left > 0 ? fill(words().left, { left: cap(hintsWord(left)), where: m.where }) : '',
  };
}

/** "two hints", "one hint". */
const hintsWord = (n: number): string =>
  `${content.annals.counts[n] ?? n} hint${n === 1 ? '' : 's'}`;

/** One way `p` knows: how they came by it, when, and what it does. */
function knownRow(world: WorldState, k: EntityRow): WayRow | undefined {
  const m = methodDef(content, k['method'] as string);
  if (!m) return undefined;
  const how = fill(words().how[k['how'] as keyof MethodsScreen['how']] ?? '', {
    from: nameOf(world, k['from']),
  });
  const line = k['line'] as number;
  const effect = effectOf(m.id);
  return {
    text: fill(words().knows, { method: m.name }),
    note: fill(words().known, { how, date: dateOf(world, line), Effect: cap(effect) }),
    ...whyOf(world, line),
  };
}

/** A person's new ways: the puzzle they are on and each way they know; none when neither. */
export function personWays(world: WorldState, p: EntityRow): { ways?: PersonWaysView } {
  const puzzle = puzzleView(world, p);
  const known = knowsOf(world)
    .filter((k) => k['person'] === p.id)
    .flatMap((k) => knownRow(world, k) ?? []);
  if (!puzzle && !known.length) return {};
  return { ways: { ...(puzzle && { puzzle }), known } };
}

/** A way the colony knows: who found and who learnt it among the living, or the one who alone
 * knows it, and what it does. */
function colonyRow(world: WorldState, method: string, rows: readonly EntityRow[]): WayRow {
  const m = methodDef(content, method)!;
  const living = new Set(knowersOf(world, method).map((p) => p.id));
  const mine = rows.filter((k) => living.has(k['person'] as number));
  const names = (how: (k: EntityRow) => boolean) =>
    list(mine.filter(how).map((k) => nameOf(world, k['person'])));
  const found = names((k) => k['how'] === 'found');
  const learnt = names((k) => k['how'] !== 'found');
  const who =
    mine.length === 1
      ? fill(words().only, { name: nameOf(world, mine[0]!['person']) })
      : [
          found && fill(words().found, { names: found }),
          learnt && fill(words().learnt, { names: learnt }),
        ]
          .filter(Boolean)
          .join('; ') + '.';
  const first = rows.find((k) => k['how'] === 'found') ?? rows[0]!;
  return {
    text: cap(m.name),
    note: `${who} ${cap(effectOf(method))}.`,
    ...whyOf(world, first['line'] as number),
  };
}

/** The colony's ways under the New Ways law: each way a living colonist knows, in the order they
 * were first known, then what is being puzzled over and by whom. */
export function colonyWays(world: WorldState): ColonyWaysView {
  const byWay = new Map<string, EntityRow[]>();
  for (const k of knowsOf(world)) {
    const m = k['method'] as string;
    byWay.set(m, [...(byWay.get(m) ?? []), k]);
  }
  const known = [...byWay]
    .filter(([m]) => knowersOf(world, m).length > 0)
    .map(([m, rows]) => colonyRow(world, m, rows));
  // Each way puzzled over once, with everyone on it: "a heavier plough (Ann, 0 of 4 hints;
  // Bryn, 1 of 4 hints)".
  const byMethod = new Map<string, { who: string[]; why: number }>();
  for (const p of alive(world)) {
    const puzzle = puzzleOf(world, p.id);
    const m = puzzle && methodDef(content, puzzle['method'] as string);
    if (!puzzle || !m) continue;
    const hints = hintsOf(world, puzzle.id);
    const last = (hints.at(-1)?.['line'] ?? puzzle['line']) as number;
    const who = fill(words().puzzlerWho, {
      name: p['name'] as string,
      n: hints.length,
      of: m.hints,
    });
    const at = byMethod.get(m.name) ?? { who: [], why: 0 };
    byMethod.set(m.name, { who: [...at.who, who], why: Math.max(at.why, last) });
  }
  const puzzles = [...byMethod].map(([method, at]) => ({
    text: fill(words().puzzler, { method, who: at.who.join('; ') }),
    why: at.why,
  }));
  const latest = Math.max(0, ...puzzles.map((p) => p.why));
  return {
    known,
    ...(!known.length && { none: words().none }),
    puzzled: {
      text: words().puzzled,
      note: puzzles.length ? `${cap(list(puzzles.map((p) => p.text)))}.` : words().nobody,
      ...(latest > 0 && whyOf(world, latest)),
    },
  };
}
