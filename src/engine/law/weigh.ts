// How a person weighs a law's setting (P4.8, V-091): willingness from mood, low needs, traits,
// held memories and the season, each named for and against so the reason can be read. All the
// numbers are content (laws.json).
import type { EngineContent, LawSettingDef, WorldState } from '../core/index.ts';
import { memoriesOf, moodOf, needOf } from '../needs/index.ts';
import { isWinter } from './hours.ts';

export type Answer = 'obeys' | 'grumbles' | 'refuses';

export interface Weighed {
  will: number;
  answer: Answer;
  for: string[];
  against: string[];
  /** The lines behind the memories that weighed. */
  cites: number[];
  /** The memories that weighed, as `id:line` joined, to see when one is added. */
  mems: string;
}

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

export function weigh(
  world: WorldState,
  content: EngineContent,
  person: number,
  s: LawSettingDef,
): Weighed {
  const { answer: dial } = content.laws;
  const pro: string[] = [];
  const con: string[] = [];
  const side = (by: number, word: string) => (by > 0 ? pro : by < 0 ? con : []).push(word);
  let will = dial.start - s.ask;
  const mood = (moodOf(world, person)?.['value'] as number | undefined) ?? content.life.scale / 2;
  const byMood = Math.round((mood - content.life.scale / 2) / dial.moodPer);
  will += byMood;
  side(byMood, byMood > 0 ? 'in good spirits' : 'in low spirits');
  for (const need of dial.needs) {
    if (!needOf(world, person, need)?.['low']) continue;
    will += dial.low;
    const def = content.life.needs.find((n) => n.id === need);
    con.push(lower(def?.lowWord ?? need));
  }
  const traits = (world.entities['trait'] ?? []).filter((t) => t['person'] === person);
  for (const t of traits) {
    const by = s.traits[t['trait'] as string] ?? 0;
    will += by;
    const name = content.traits.find((d) => d.id === t['trait'])?.name ?? (t['trait'] as string);
    side(by, name);
  }
  const people = world.entities['person'] ?? [];
  const cites: number[] = [];
  const mems: string[] = [];
  for (const m of memoriesOf(world, person)) {
    const id = m['memory'] as string;
    const by = s.memories[id] ?? 0;
    if (!by) continue;
    will += by;
    const def = content.memories.find((d) => d.id === id);
    const about = people.find((p) => p.id === m['about'])?.['name'] as string | undefined;
    side(by, lower((def?.text ?? id).replace('{about}', about ?? 'someone')));
    cites.push(m['line'] as number);
    mems.push(`${id}:${m['line'] as number}`);
  }
  if (s.winterLean && isWinter(world, content)) {
    will += s.winterLean;
    side(s.winterLean, s.winterLean < 0 ? 'the dark winter days' : 'the short winter days');
  }
  const answer: Answer =
    will >= dial.obey ? 'obeys' : will >= dial.grumble ? 'grumbles' : 'refuses';
  return { will, answer, for: pro, against: con, cites, mems: mems.sort().join(',') };
}

/** What a memory leans on a setting, in words ("leans against long days"), or none. */
export function leanOf(s: LawSettingDef, memory: string): string | undefined {
  const by = s.memories[memory] ?? 0;
  if (!by) return undefined;
  return `leans ${by < 0 ? 'against' : 'towards'} ${s.days.replace(/^the /, '')}`;
}
