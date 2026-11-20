// What stands behind a grievance (P6.7, V-160): the law a person is furthest from keeping and by
// how much, the memory that weighs most against it and the belief that carries it into acts.
// Every act's line cites all three: the answer, the memory and the belief.
import type { EngineContent, EntityRow, LawSettingDef, WorldState } from '../core/index.ts';
import { storeLasts } from '../goods/index.ts';
import { settingOf } from '../law/index.ts';
import { memoriesOf } from '../needs/index.ts';
import { beliefsOf } from '../tales/index.ts';
import { lower } from '../core/index.ts';

export interface Grievance {
  law: string;
  setting: LawSettingDef;
  /** Their answer row to it. */
  answer: EntityRow;
  /** Points short of keeping it. */
  by: number;
}

export interface Why {
  /** The memory row that weighs most against the setting, and the belief row behind it. */
  mem?: EntityRow | undefined;
  belief?: EntityRow | undefined;
}

/** The law `person` is furthest short of keeping (its answer row says by how much). */
export function grievanceOf(
  world: WorldState,
  content: EngineContent,
  person: number,
): Grievance | undefined {
  const obey = content.laws.answer.obey;
  let best: Grievance | undefined;
  for (const a of world.entities['answer'] ?? []) {
    if (a['person'] !== person) continue;
    const law = a['law'] as string;
    const by = obey - (a['will'] as number);
    if (by <= 0 || (best && by <= best.by)) continue;
    best = { law, setting: settingOf(world, content, law), answer: a, by };
  }
  return best;
}

/** The memory and belief behind a grievance with setting `s`, if they hold them. */
export function reasonsOf(
  world: WorldState,
  content: EngineContent,
  person: number,
  s: LawSettingDef,
): Why {
  const lean = (m: EntityRow) => s.memories[m['memory'] as string] ?? 0;
  const mem = memoriesOf(world, person)
    .filter((m) => lean(m) < 0)
    .sort((a, b) => lean(a) - lean(b) || (b['line'] as number) - (a['line'] as number))[0];
  const belief = beliefsOf(world, person).find(
    (b) =>
      (s.beliefs ?? []).includes(b['belief'] as string) &&
      (b['strength'] as number) >= content.defy.belief,
  );
  return { mem, belief };
}

/** Hard times without a law (6A review P2): someone who went hungry and holds the defy.json
 * `starving` belief strongly enough has the memory and belief to take from a store that will not
 * last to the harvest, at any Rations setting. */
export function hungerWhy(world: WorldState, content: EngineContent, person: number): Why {
  const st = content.defy.starving;
  if (storeLasts(world, content, 0)) return {};
  const mem = memoriesOf(world, person)
    .filter((m) => m['memory'] === st.memory)
    .sort((a, b) => (b['line'] as number) - (a['line'] as number))[0];
  const belief = beliefsOf(world, person).find(
    (b) => b['belief'] === st.belief && (b['strength'] as number) >= content.defy.belief,
  );
  return mem && belief ? { mem, belief } : {};
}

/** "went to bed hungry; thinks the store is kept for the few". */
export function whyWords(world: WorldState, content: EngineContent, why: Why): string {
  const parts: string[] = [];
  if (why.mem) {
    const def = content.memories.find((d) => d.id === why.mem!['memory']);
    const about = (world.entities['person'] ?? []).find((p) => p.id === why.mem!['about']);
    parts.push(
      lower((def?.text ?? '').replace('{about}', (about?.['name'] as string) ?? 'someone')),
    );
  }
  if (why.belief) {
    const def = content.tales.beliefs.find((b) => b.id === why.belief!['belief']);
    const strength = content.tales.strength[(why.belief['strength'] as number) - 1] ?? '';
    parts.push(`${lower(strength)} ${def?.text ?? ''}`);
  }
  return parts.join('; ');
}

/** The lines an act cites: the answer, the memory and the belief. */
export const citesOf = (g: Grievance, why: Why): number[] =>
  [g.answer['line'] as number, why.mem?.['line'] as number, why.belief?.['line'] as number].filter(
    (l) => typeof l === 'number' && l > 0,
  );
