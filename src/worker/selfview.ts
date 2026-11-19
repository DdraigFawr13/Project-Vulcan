// Who a person is, as the Memories tab shows it (P6.4, V-146, V-156): the roles they see
// themselves in, each with what most made it and the line it came on, and their life ambition
// with whether it is done. Words only; the rules live in engine self. A pure read.
import { content } from '../content/index.ts';
import {
  ambitionOf,
  ambitionText,
  rolesOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { SelfView } from './protocol-people.ts';

const upper = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** `p`'s roles, strongest first, and ambition. */
export function selfView(world: WorldState, p: EntityRow): { self: SelfView } {
  const roles = rolesOf(world, p.id).flatMap((r) => {
    const def = content.self.roles.find((d) => d.id === r['role']);
    if (!def) return [];
    const why = r['why'] as string;
    return [
      {
        text: `Sees themselves as ${def.name}.`,
        note: why ? `${upper(why)}.` : '',
        why: r['line'] as number,
      },
    ];
  });
  const a = ambitionOf(world, p.id);
  const ambition = a
    ? {
        text: a['done']
          ? `Set out ${ambitionText(content, a)}, and did.`
          : `Wants ${ambitionText(content, a)}.`,
        why: a['line'] as number,
      }
    : undefined;
  return { self: { roles, ...(ambition ? { ambition } : {}) } };
}
