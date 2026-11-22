// A calling's bar (6B Bundle 6, V-189 q8 and q9): each test of a stage measures one thing about a
// person (callings.json `test`), passes or not, and says it in words for the line. Tallies of
// ledger lines (`lines` tests) are kept in the system's state by `tally.ts`.
import type { CallingTest, EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { lower } from '../core/index.ts';
import { talkersOf, trustOf } from '../colony/index.ts';
import { alive, tableOf as rows } from '../entity/index.ts';
import { grown } from '../family/index.ts';
import { heldMemoriesOf } from '../needs/index.ts';
import { ambitionOf, rolesOf } from '../self/index.ts';
import { countOf } from './tally.ts';

export interface Measure {
  pass: boolean;
  /** The measure the calling's `best` test ranks by. */
  score: number;
  word: string;
  /** The trade skill it speaks of, if any, and a line behind it (0 for none). */
  skill: string;
  cite: number;
}

const skillName = (content: EngineContent, id: string): string =>
  lower(content.abilities.find((a) => a.id === id)?.name ?? id);

/** The grown and living, most trusted first (ties to the lower id). */
export function byTrust(
  world: WorldState,
  content: EngineContent,
): { id: number; trust: number }[] {
  return alive(world)
    .filter((q) => grown(world, content, q))
    .map((q) => ({ id: q.id, trust: trustOf(world, content, q).trust }))
    .sort((a, b) => b.trust - a.trust || a.id - b.id);
}

interface Seen {
  world: WorldState;
  content: EngineContent;
  state: Record<string, number>;
  trust: { id: number; trust: number }[];
}

const fill = (word: string, n: number | string, of = 0, skill = ''): string =>
  word.replace('{n}', String(n)).replace('{of}', String(of)).replace('{skill}', skill);

function traitTest(s: Seen, p: EntityRow, t: CallingTest): Measure {
  const held = rows(s.world, 'trait')
    .filter((r) => r['person'] === p.id)
    .map((r) => r['trait'] as string);
  const any = t.any?.find((id) => held.includes(id));
  const pass = (!t.any || !!any) && !t.none?.some((id) => held.includes(id));
  const name = lower(s.content.traits.find((d) => d.id === any)?.name ?? '');
  return { pass, score: pass ? 1 : 0, word: fill(t.word, name), skill: '', cite: 0 };
}

function friendsTest(s: Seen, p: EntityRow, t: CallingTest): Measure {
  const others = alive(s.world).filter((q) => q.id !== p.id);
  const n = talkersOf(s.world, s.content, p).length;
  const pass = others.length > 0 && n * 100 >= (t.share ?? 0) * others.length;
  return { pass, score: n, word: fill(t.word, n, others.length), skill: '', cite: 0 };
}

function skillTest(s: Seen, p: EntityRow, t: CallingTest): Measure {
  const best = rows(s.world, 'skill')
    .filter((r) => r['person'] === p.id && t.skills?.includes(r['skill'] as string))
    .sort((a, b) => (b['level'] as number) - (a['level'] as number) || a.id - b.id)[0];
  const level = (best?.['level'] as number) ?? 0;
  const skill = (best?.['skill'] as string) ?? '';
  const word = fill(t.word, level, 0, skillName(s.content, skill));
  return { pass: level >= (t.from ?? 0), score: level, word, skill, cite: 0 };
}

function ambitionTest(s: Seen, p: EntityRow, t: CallingTest): Measure {
  const a = ambitionOf(s.world, p.id);
  const pass = !!a && a['ambition'] === t.id && !!a['done'];
  const skill = pass ? (a['skill'] as string) : '';
  const level = rows(s.world, 'skill').find((r) => r['person'] === p.id && r['skill'] === skill);
  const score = (level?.['level'] as number) ?? 0;
  // With `from`, the ambition's skill must stand there too (the masterwork path, V-207).
  const ok = pass && score >= (t.from ?? 0);
  const word = fill(t.word, score, 0, skillName(s.content, skill));
  return { pass: ok, score, word, skill, cite: ok ? (a['line'] as number) : 0 };
}

function heldTest(s: Seen, p: EntityRow, t: CallingTest): Measure {
  const row =
    t.test === 'memory'
      ? heldMemoriesOf(s.world, p.id).find((m) => m['memory'] === t.id)
      : rolesOf(s.world, p.id).find((r) => r['role'] === t.id);
  const cite = (row?.['line'] as number) ?? 0;
  return { pass: !!row, score: row ? 1 : 0, word: t.word, skill: '', cite };
}

function countTest(s: Seen, p: EntityRow, t: CallingTest): Measure {
  const { n, last } =
    t.test === 'lines'
      ? countOf(s.state, t.event ?? '', t.actor ?? 0, p.id)
      : t.test === 'tales'
        ? { n: rows(s.world, 'tale').filter((r) => r['person'] === p.id).length, last: 0 }
        : { n: (p[t.attr ?? ''] as number) ?? 0, last: 0 };
  return { pass: n >= (t.from ?? 0), score: n, word: fill(t.word, n), skill: '', cite: last };
}

function trustedTest(s: Seen, p: EntityRow, t: CallingTest): Measure {
  const rank = s.trust.findIndex((x) => x.id === p.id);
  const pass = rank >= 0 && rank < (t.top ?? 1);
  return { pass, score: s.trust[rank]?.trust ?? 0, word: t.word, skill: '', cite: 0 };
}

/** One test of `p`. */
export function measure(s: Seen, p: EntityRow, t: CallingTest): Measure {
  switch (t.test) {
    case 'trait':
      return traitTest(s, p, t);
    case 'trusted':
      return trustedTest(s, p, t);
    case 'friends':
      return friendsTest(s, p, t);
    case 'skill':
      return skillTest(s, p, t);
    case 'ambition':
      return ambitionTest(s, p, t);
    case 'memory':
    case 'role':
      return heldTest(s, p, t);
    case 'either': {
      const all = (t.or ?? []).map((o) => measure(s, p, o));
      return (
        all.find((m) => m.pass) ?? all[0] ?? { pass: false, score: 0, word: '', skill: '', cite: 0 }
      );
    }
    default:
      return countTest(s, p, t);
  }
}

export type { Seen };
