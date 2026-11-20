// Who a person is, as the Memories tab shows it (P6.4, V-146, V-156): the roles they see
// themselves in, each with what most made it and the line it came on, and their life ambition
// with whether it is done. Words only; the rules live in engine self. A pure read.
import { content } from '../content/index.ts';
import {
  ambitionOf,
  ambitionText,
  defyOf,
  grievanceOf,
  reasonsOf,
  rolesOf,
  whyWords,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { SelfView } from './protocol-people.ts';
import { faithSelf } from './faithview.ts';
import { teachSelf } from './teachview.ts';

const upper = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The act step a grievance holds `p` on (working slowly or past it), with the memory and belief
 * behind it; none on a law answer's step (grumbling, refusing: the Laws sheet shows those). */
function defianceOf(world: WorldState, p: EntityRow): SelfView['defiance'] {
  const row = defyOf(world, p.id);
  const steps = content.defy.steps;
  const step = steps[((row?.['step'] as number | undefined) ?? 0) - 1];
  const g = grievanceOf(world, content, p.id);
  if (!row || !step || step.answer || !g) return undefined;
  const why = whyWords(world, content, reasonsOf(world, content, p.id, g.setting));
  return {
    text: `${upper(step.name)}, against ${g.setting.days} (step ${row['step'] as number} of ${steps.length}).`,
    note: why ? `${upper(why)}.` : '',
    why: row['line'] as number,
  };
}

/** `p`'s roles, strongest first, ambition and defiance. */
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
  const defiance = defianceOf(world, p);
  const faith = faithSelf(world, p);
  const teaching = teachSelf(world, p);
  return {
    self: {
      roles,
      ...(ambition ? { ambition } : {}),
      ...(defiance ? { defiance } : {}),
      ...(faith ? { faith } : {}),
      ...(teaching ? { teaching } : {}),
    },
  };
}
