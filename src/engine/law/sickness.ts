// The Sickness law (P6.5, V-144): a setting with `sick` lays the catching-sick in a sick-house
// (`house`) or sends them out of the valley (`away`). The law only says so; people/apart.ts acts
// on it, where kin may refuse it, and build/sickhouse.ts sites the house.
import type { EngineContent, EntityRow, LawSettingDef, WorldState } from '../core/index.ts';
import { lawRow, settingOf } from './hours.ts';

/** The law in force that lays the catching-sick apart, its setting and the line that set it. */
export function sickRule(
  world: WorldState,
  content: EngineContent,
): { law: string; s: LawSettingDef; line: number } | undefined {
  for (const def of content.laws.laws) {
    const s = settingOf(world, content, def.id);
    if (s.sick) return { law: def.id, s, line: (lawRow(world, def.id)?.['line'] as number) ?? 0 };
  }
  return undefined;
}

/** `person`'s answer to `law`, if they have one. */
export const answerTo = (world: WorldState, law: string, person: number): EntityRow | undefined =>
  (world.entities['answer'] ?? []).find((a) => a['person'] === person && a['law'] === law);
