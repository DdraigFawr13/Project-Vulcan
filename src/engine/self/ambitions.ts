// Life ambitions (P6.4, V-146): every `ambition.checkDays` days someone without one takes up one
// that fits them at `chance` per cent (the self system's dice pick among those that fit): a
// masterwork in their best craft, a trade they have it in them to learn, or a house of their own.
// A masterwork needs the potential for it; a trade is one barely begun. Those who practise give a minute in every `every` of their free time to the skill (people
// `mind.ts`). Each day an ambition reached is a line, and they gain `ambition.memory`.
import {
  pronouns,
  type AmbitionDef,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { builtHome } from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { ambitionOf, ambitionText } from './tables.ts';

const skillsOf = (world: WorldState, person: number): EntityRow[] =>
  (world.entities['skill'] ?? []).filter((s) => s['person'] === person);

const level = (s: EntityRow | undefined): number => (s?.['level'] as number | undefined) ?? 0;

/** The skill `def` would be about for `p` ('' for a house), or undefined when it does not fit. */
function fits(world: WorldState, def: AmbitionDef, p: EntityRow): string | undefined {
  const mine = skillsOf(world, p.id).filter((s) => def.skills?.includes(s['skill'] as string));
  if (def.kind === 'house') return builtHome(world, p.id) ? undefined : '';
  const to = def.to ?? 0;
  if (def.kind === 'master') {
    const best = mine.sort((a, b) => level(b) - level(a) || a.id - b.id)[0];
    const can = best && level(best) >= (def.from ?? 0) && (best['potential'] as number) >= to;
    return can && level(best) < to ? (best['skill'] as string) : undefined;
  }
  const open = mine
    .filter((s) => (s['potential'] as number) >= (def.from ?? 0) && level(s) < (def.under ?? to))
    .sort((a, b) => (b['potential'] as number) - (a['potential'] as number) || a.id - b.id)[0];
  return open?.['skill'] as string | undefined;
}

/** Whether `a` is reached. */
function reached(world: WorldState, content: EngineContent, a: EntityRow): boolean {
  const def = content.self.ambitions.find((d) => d.id === a['ambition']);
  if (!def) return false;
  const person = a['person'] as number;
  if (def.kind === 'house') return !!builtHome(world, person);
  const s = skillsOf(world, person).find((r) => r['skill'] === a['skill']);
  return !!s && level(s) >= (def.to ?? 0);
}

/** Someone without an ambition may take one up. */
export function takeUp(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  if (ambitionOf(world, p.id)) return;
  const rng = ctx.rng();
  if (rng.int(100) >= content.self.ambition.chance) return;
  const open = content.self.ambitions.flatMap((def) => {
    const skill = fits(world, def, p);
    return skill === undefined ? [] : [{ def, skill }];
  });
  if (!open.length) return;
  const { def, skill } = rng.pick(open);
  const row = { person: p.id, ambition: def.id, skill, since: world.tick, done: 0 };
  const text = ambitionText(content, { id: 0, ...row }, pronouns(p).their);
  const line = ctx.emit('self.ambition', {
    causes: [p['arrived'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, text },
  });
  addEntity(world, 'ambition', { ...row, line });
}

/** An ambition reached is a line and a memory. */
export function fulfil(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const a = ambitionOf(world, p.id);
  if (!a || a['done'] || !reached(world, content, a)) return;
  const line = ctx.emit('self.fulfilled', {
    causes: [a['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, text: ambitionText(content, a, pronouns(p).their) },
  });
  a['done'] = 1;
  addMemory(ctx, p.id, content.self.ambition.memory, line);
}
