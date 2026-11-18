// What is on a person's mind (P6.2, V-154): one line from content, chosen in order: the lowest
// need under its warning line; else a memory they gained in the last `life.memory.recentHours`;
// else their strongest memory (heaviest, then fresh before lingering, then the most mood); else
// `life.memory.thoughts.none`. Each list holds a few lines and a person's own hash picks one, so
// two people with the same memory can say it differently. Fixed text, no randomness.
import {
  clockAt,
  hashString,
  TICKS_PER_HOUR,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { bandOf, heldMemoriesOf } from './memory.ts';

export interface Thought {
  text: string;
  /** The line it comes from, for "why?": the low line, or the memory's cause (0 for none). */
  why: number;
}

/** The season the run of a memory began in ("spring"). */
const seasonOf = (content: EngineContent, m: EntityRow): string =>
  content.calendar.seasons[clockAt(m['since'] as number, content.calendar).season] ?? '';

const nameOf = (world: WorldState, id: number): string =>
  ((world.entities['person'] ?? []).find((q) => q.id === id)?.['name'] as string) ?? 'someone';

/** A memory in words: its heavy name once heavy ("The hungry spring"), else its text. */
export function memoryName(world: WorldState, content: EngineContent, m: EntityRow): string {
  const def = content.memories.find((d) => d.id === m['memory']);
  if (!def) return '';
  const heavy = def.heavy && bandOf(content, m['weight'] as number) !== 'light';
  const text = heavy ? def.heavy!.name : def.text;
  return fill(text, { about: nameOf(world, m['about'] as number), season: seasonOf(content, m) });
}

function fill(text: string, words: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => words[k] ?? '');
}

const pick = (lines: readonly string[], person: number, key: string): string =>
  lines[hashString(`${person}:${key}`) % lines.length] ?? '';

/** The strongest first: heaviest, fresh before lingering, most mood, newest. */
export function strongestFirst(world: WorldState, content: EngineContent, rows: EntityRow[]) {
  const mood = (m: EntityRow) =>
    Math.abs(content.memories.find((d) => d.id === m['memory'])?.mood ?? 0);
  const fresh = (m: EntityRow) => (world.tick < (m['until'] as number) ? 1 : 0);
  return [...rows].sort(
    (a, b) =>
      (b['weight'] as number) - (a['weight'] as number) ||
      fresh(b) - fresh(a) ||
      mood(b) - mood(a) ||
      (b['since'] as number) - (a['since'] as number),
  );
}

function memoryThought(world: WorldState, content: EngineContent, p: number, m: EntityRow) {
  const def = content.memories.find((d) => d.id === m['memory']);
  if (!def) return undefined;
  const heavy = bandOf(content, m['weight'] as number) !== 'light';
  const own = (heavy && def.heavyThoughts) || def.thoughts;
  const { good, bad } = content.life.memory.thoughts;
  const lines = own?.length ? own : def.mood < 0 ? bad : good;
  const name = memoryName(world, content, m);
  const memory = name.charAt(0).toLowerCase() + name.slice(1);
  const words = { about: nameOf(world, m['about'] as number), season: seasonOf(content, m) };
  const text = fill(pick(lines, p, def.id), { ...words, memory });
  return { text: text.charAt(0).toUpperCase() + text.slice(1), why: m['line'] as number };
}

/** What `person` is thinking now. */
export function thoughtOf(world: WorldState, content: EngineContent, person: number): Thought {
  const needs = (world.entities['need'] ?? []).filter((n) => n['person'] === person && n['low']);
  const low = needs.reduce<EntityRow | undefined>(
    (a, n) => (!a || (n['value'] as number) < (a['value'] as number) ? n : a),
    undefined,
  );
  const def = low && content.life.needs.find((d) => d.id === low['need']);
  if (low && def?.thoughts.length)
    return { text: pick(def.thoughts, person, def.id), why: low['line'] as number };
  const held = heldMemoriesOf(world, person);
  const since = world.tick - content.life.memory.recentHours * TICKS_PER_HOUR;
  const recent = held
    .filter((m) => (m['since'] as number) >= since)
    .sort((a, b) => (b['since'] as number) - (a['since'] as number));
  for (const m of [...recent, ...strongestFirst(world, content, held)]) {
    const t = memoryThought(world, content, person, m);
    if (t) return t;
  }
  return { text: pick(content.life.memory.thoughts.none, person, 'none'), why: 0 };
}
