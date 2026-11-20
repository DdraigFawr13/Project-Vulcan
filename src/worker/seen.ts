// Seen at work (V-190, V-194): what the map shows of a person's work, from what the engine already
// decided. The motion of the job they stand working (jobs.json `motion` and `effect`, or work.json
// `motions` for work that is not a jobs.json row), the tool that serves the job they work or walk
// to, and the load they carry. A pure read of the world; the map draws these and works out nothing.
import { content } from '../content/index.ts';
import {
  heldBy,
  loadOf,
  speedOf,
  toolOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { ActView, WalkerView } from './protocol-people.ts';

type Look = { motion: string; effect?: ActView['effect'] };

/** A job's look: its jobs.json row, else its work.json `motions` entry. */
function lookOf(job: string): Look | undefined {
  return content.jobs.find((j) => j.id === job) ?? content.work.motions[job];
}

const DRAWN = new Set(['swing', 'dig', 'crouch', 'stir', 'bench']);

/** The best tool the person holds of the kind that serves `use` (tools.json `serves`). */
function toolFor(world: WorldState, p: EntityRow, use: string): EntityRow | undefined {
  const kind = content.tools.kinds.find((k) => k.serves.includes(use))?.id;
  if (!kind) return undefined;
  return heldBy(world, content, p.id)
    .filter((i) => toolOf(content, i)?.kind === kind)
    .sort((a, b) => speedOf(content, b) - speedOf(content, a) || a.id - b.id)[0];
}

/** The `act`, `held` and `load` fields of a walker (protocol-people.ts). */
export function seenOf(world: WorldState, p: EntityRow): Pick<WalkerView, 'act' | 'held' | 'load'> {
  if (p['status'] === 'dead' || p['status'] === 'away') return {};
  const load = loadOf(world, p.id);
  if (load) return { load: `item.${load['kind'] as string}` };
  if (p['doing'] !== 'work') return {};
  const job = p['job'] as string;
  const task = (p['task'] as string | undefined) ?? '';
  const tool = toolFor(world, p, job) ?? (task ? toolFor(world, p, task) : undefined);
  const held = tool && { held: `item.${tool['kind'] as string}` };
  const walking = ((p['path'] as number[] | undefined) ?? []).length > 0;
  const look = lookOf(job);
  if (walking || !look || !DRAWN.has(look.motion)) return { ...held };
  const act: ActView = {
    motion: look.motion as ActView['motion'],
    ...(look.effect && { effect: look.effect }),
  };
  return { ...held, act };
}
