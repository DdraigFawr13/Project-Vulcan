// What the colony leans on every answer (P6.6, V-158, V-159): its standing (low standing makes
// every law easier to refuse), the elder's own answer for their friends, and a faction's for its
// members. Read from the colony system's rows (engine colony), which imports this module, so
// the rows are read here rather than through its index.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';

export interface Lean {
  by: number;
  word: string;
  /** Its part of the reweigh signature. */
  key: string;
  cite?: number;
}

const colony = (world: WorldState): EntityRow | undefined => world.entities['standing']?.[0];

/** The elder's answer to `law`, leaning a friend of theirs the same way. */
function elderLean(
  world: WorldState,
  content: EngineContent,
  row: EntityRow,
  person: number,
  law: string,
): Lean | undefined {
  const e = content.colony.elder;
  const elder = row['elder'] as number;
  if (!elder || elder === person || !(row['friends'] as readonly number[]).includes(person)) return;
  const a = (world.entities['answer'] ?? []).find((x) => x['person'] === elder && x['law'] === law);
  const by = a?.['answer'] === 'obeys' ? e.sway : a?.['answer'] === 'refuses' ? -e.sway : 0;
  if (!a || !by) return;
  const name = (world.entities['person'] ?? []).find((p) => p.id === elder)?.['name'] as string;
  return {
    by,
    word: (by > 0 ? e.follows : e.sides).replace('{name}', name),
    key: `elder:${elder}:${a['answer'] as string}`,
    cite: a['line'] as number,
  };
}

export function colonyLeans(
  world: WorldState,
  content: EngineContent,
  person: number,
  law: string,
  alone: boolean,
): Lean[] {
  const c = content.colony;
  const row = colony(world);
  if (!row) return [];
  const out: Lean[] = [];
  const by = Math.trunc(((row['standing'] as number) - c.standing.start) / c.standing.per);
  if (by)
    out.push({
      by,
      word: by > 0 ? c.standing.trusts : c.standing.distrusts,
      key: `standing:${by}`,
    });
  if (alone) return out;
  const sway = elderLean(world, content, row, person, law);
  if (sway) out.push(sway);
  const f = (world.entities['faction'] ?? []).find(
    (x) => x['law'] === law && (x['members'] as readonly number[]).includes(person),
  );
  if (f)
    out.push({
      by: -c.faction.lean,
      word: c.faction.stands.replace('{faction}', f['name'] as string),
      key: `faction:${f.id}`,
      cite: f['line'] as number,
    });
  return out;
}
