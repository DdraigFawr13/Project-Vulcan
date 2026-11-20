// How a person weighs a law's setting (P4.8, V-091): willingness from mood, low needs, traits,
// held memories, their roles and ambition (P6.4), the colony (P6.6) and the season, each named
// for and against so the reason can be read. All the numbers are content (laws.json).
import type { EngineContent, LawSettingDef, WorldState } from '../core/index.ts';
import { storeLasts } from '../goods/index.ts';
import { memoriesOf, moodOf, needOf } from '../needs/index.ts';
import { ambitionOf, ambitionText, rolesOf } from '../self/index.ts';
import { isWinter } from './hours.ts';
import { colonyLeans } from './leans.ts';
import { lower } from '../core/index.ts';

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

/** What weighed so far: willingness, the words on each side, the lines and the signature. */
interface Tally {
  will: number;
  pro: string[];
  con: string[];
  cites: number[];
  mems: string[];
}

/** Adds `by` to the tally, named `word` on its side, with its signature `key` and line. */
function add(t: Tally, by: number, word: string, key?: string, cite?: number): void {
  t.will += by;
  if (by > 0) t.pro.push(word);
  else if (by < 0) t.con.push(word);
  if (key) t.mems.push(key);
  if (cite) t.cites.push(cite);
}

/** P6.4: the roles they see themselves in, and an ambition not yet reached. */
function selfParts(
  t: Tally,
  world: WorldState,
  content: EngineContent,
  person: number,
  s: LawSettingDef,
): void {
  for (const r of rolesOf(world, person)) {
    const by = s.roles?.[r['role'] as string] ?? 0;
    if (!by) continue;
    const name = content.self.roles.find((d) => d.id === r['role'])?.name ?? '';
    add(t, by, `sees themselves as ${name}`, `role.${r['role'] as string}:${r['line'] as number}`);
  }
  const goal = ambitionOf(world, person);
  const byGoal = goal && !goal['done'] ? (s.ambitions?.[goal['ambition'] as string] ?? 0) : 0;
  if (goal && byGoal) {
    const key = `ambition.${goal['ambition'] as string}:${goal['line'] as number}`;
    add(t, byGoal, `wants ${ambitionText(content, goal)}`, key);
  }
}

/** Mood, low needs (but those the setting expects), traits and held memories. */
function heldParts(
  t: Tally,
  world: WorldState,
  content: EngineContent,
  person: number,
  s: LawSettingDef,
): void {
  const { answer: dial } = content.laws;
  const mood = (moodOf(world, person)?.['value'] as number | undefined) ?? content.life.scale / 2;
  const byMood = Math.round((mood - content.life.scale / 2) / dial.moodPer);
  add(t, byMood, byMood > 0 ? 'in good spirits' : 'in low spirits');
  for (const need of dial.needs) {
    if (!needOf(world, person, need)?.['low'] || s.expects?.includes(need)) continue;
    const def = content.life.needs.find((n) => n.id === need);
    add(t, dial.low, lower(def?.lowWord ?? need));
  }
  for (const r of (world.entities['trait'] ?? []).filter((x) => x['person'] === person)) {
    const name = content.traits.find((d) => d.id === r['trait'])?.name ?? (r['trait'] as string);
    add(t, s.traits[r['trait'] as string] ?? 0, name);
  }
  const people = world.entities['person'] ?? [];
  for (const m of memoriesOf(world, person)) {
    const id = m['memory'] as string;
    const by = s.memories[id] ?? 0;
    if (!by) continue;
    const def = content.memories.find((d) => d.id === id);
    const about = people.find((p) => p.id === m['about'])?.['name'] as string | undefined;
    const word = lower((def?.text ?? id).replace('{about}', about ?? 'someone'));
    add(t, by, word, `${id}:${m['line'] as number}`, m['line'] as number);
  }
}

/** P6.5: whether the store lasts to the harvest (Rations), and the season. */
function seasonParts(t: Tally, world: WorldState, content: EngineContent, s: LawSettingDef): void {
  if (s.store) {
    const lasts = storeLasts(world, content, 0);
    const word = lasts
      ? 'the store lasts to the harvest'
      : 'the store will not last to the harvest';
    add(t, lasts ? s.store.lasts : s.store.short, word, `store:${lasts ? 'lasts' : 'short'}`);
  }
  if (s.winterLean && isWinter(world, content))
    add(t, s.winterLean, s.winterLean < 0 ? 'the dark winter days' : 'the short winter days');
}

export function weigh(
  world: WorldState,
  content: EngineContent,
  person: number,
  s: LawSettingDef,
  opts: { alone?: boolean } = {},
): Weighed {
  const { answer: dial } = content.laws;
  const t: Tally = { will: dial.start - s.ask, pro: [], con: [], cites: [], mems: [] };
  // P6.6: the elder's answer for their friends and a faction's for its members, first so the
  // line names them (`alone` leaves both out: how the person weighs it by themself); then their
  // roles and ambition; the colony's standing after the rest.
  const law = content.laws.laws.find((l) => l.settings.includes(s))?.id ?? '';
  const leans = colonyLeans(world, content, person, law, !!opts.alone);
  const isStanding = (key: string) => key.startsWith('standing');
  for (const l of leans.filter((x) => !isStanding(x.key))) add(t, l.by, l.word, l.key, l.cite);
  selfParts(t, world, content, person, s);
  heldParts(t, world, content, person, s);
  for (const l of leans.filter((x) => isStanding(x.key))) add(t, l.by, l.word, l.key, l.cite);
  seasonParts(t, world, content, s);
  const answer: Answer =
    t.will >= dial.obey ? 'obeys' : t.will >= dial.grumble ? 'grumbles' : 'refuses';
  return {
    will: t.will,
    answer,
    for: t.pro,
    against: t.con,
    cites: t.cites,
    mems: t.mems.sort().join(','),
  };
}

/** What a memory leans on a setting, in words ("leans against long days"), or none. */
export function leanOf(s: LawSettingDef, memory: string): string | undefined {
  const by = s.memories[memory] ?? 0;
  if (!by) return undefined;
  return `leans ${by < 0 ? 'against' : 'towards'} ${s.days.replace(/^the /, '')}`;
}
