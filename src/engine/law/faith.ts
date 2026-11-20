// How a person's faith leans a law setting (6B Bundle 4, P6.8, V-161, V-187): a setting's
// `values` say what it serves (+1) or harms (−1); a follower leans towards one that serves what
// their faith holds sacred, and against one that serves what it abhors, by worship.json `lean` at
// devotion 10, scaled down with their devotion. Read from the faith tables (engine faith) as data,
// so the law imports nothing of the faith system.
import type { EngineContent, LawSettingDef, WorldState } from '../core/index.ts';

export interface FaithLean {
  by: number;
  word: string;
  key: string;
}

/** A person's creed row, its faiths.json def and their lean at their devotion, if they hold one. */
function heldFaith(world: WorldState, content: EngineContent, person: number) {
  const f = (world.entities['faithful'] ?? []).find((r) => r['person'] === person);
  const creed = f && (world.entities['creed'] ?? []).find((c) => c.id === f['creed']);
  const def = creed && content.faiths.defs.find((d) => d.id === creed['faith']);
  if (!f || !creed || !def) return undefined;
  return { creed, def, lean: Math.round((content.worship.lean * (f['devotion'] as number)) / 10) };
}

export function faithLeans(
  world: WorldState,
  content: EngineContent,
  person: number,
  s: LawSettingDef,
): FaithLean[] {
  const held = s.values && heldFaith(world, content, person);
  if (!held || !held.lean) return [];
  const { def, creed, lean } = held;
  const name = (creed['name'] as string).replace(/^The /, 'the ');
  const out: FaithLean[] = [];
  for (const [value, sign] of Object.entries(s.values!)) {
    const sacred = def.sacred.includes(value);
    if (!sacred && def.abhors !== value) continue;
    out.push({
      by: (sacred ? sign : -sign) * lean,
      word: `${name} ${sacred ? 'holds' : 'abhors'} ${value}${sacred ? ' sacred' : ''}`,
      key: `faith.${creed.id}.${value}`,
    });
  }
  return out;
}
