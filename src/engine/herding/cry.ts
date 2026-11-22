// Answering the cry (6B review q2, V-207): when a wolf falls on someone, the bold, armed grown-ups
// within `folk.cry.earshot` tiles, woken if asleep, run to them (`wild.cry`, naming each). The
// wolf worries its prey for `folk.cry.minutes`; then the fight (fight.ts) is fought with whoever
// came. Meanwhile the one fallen on (`doing` `held`) and the wolf stay where they are, and the
// runners (`answer`) run, a step more a minute than a walk, and wait beside them once there,
// remembering they stood (`stood-together`). Nobody is sent (V-041): their own nerve, as at a
// sighting. With nobody in earshot the fight is at once, as before. State (the people system's):
// `fWolf`, `fTarget`, `fUntil`, `fCry`, `fFled`, the target's `fX`, `fY`, the wolf's `fWx`, `fWy`.
import { cheb, list, type EntityRow } from '../core/index.ts';
import { people, spotOf, stepAlong, walkTo } from '../band/index.ts';
import { grown } from '../family/index.ts';
import { isDown, pronouns, stopFor } from '../health/index.ts';
import { addMemory } from '../needs/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { animalsOf } from '../wild/index.ts';
import { readyToStand } from './flee.ts';

const KEYS = ['fWolf', 'fTarget', 'fUntil', 'fCry', 'fFled', 'fX', 'fY', 'fWx', 'fWy'] as const;

/** Whether `p` is in a fight under way: held by the wolf or running to answer the cry. */
export const inCry = (ctx: SystemContext, p: EntityRow): boolean =>
  !!ctx.state['fWolf'] && (p['doing'] === 'held' || p['doing'] === 'answer');

/** Those who hear `target` cry out and will come: bold, armed, grown, on their feet or asleep,
 * within earshot and able to reach them; nearest first. */
function hearers(ctx: SystemContext, target: EntityRow): EntityRow[] {
  const { world, content } = ctx;
  const there = spotOf(target);
  const far = (q: EntityRow) => cheb(spotOf(q), there);
  return people(world)
    .filter(
      (q) =>
        q.id !== target.id &&
        q['status'] === 'alive' &&
        q['z'] === 0 &&
        !isDown(world, q.id) &&
        far(q) <= content.wild.folk.cry.earshot &&
        grown(world, content, q) &&
        readyToStand(ctx, q) &&
        canReach(content, world.map, spotOf(q), there),
    )
    .sort((a, b) => far(a) - far(b) || a.id - b.id);
}

/**
 * The wolf falls on `target` (`why`: "alone in the open"; `cause`: the line behind it). If any
 * hear the cry, they set off, the line is written and true is returned: the fight waits. Else
 * false, and the fight is at once.
 */
export function startCry(
  ctx: SystemContext,
  wolf: EntityRow,
  target: EntityRow,
  why: string,
  cause: number,
): boolean {
  const { world, content, state } = ctx;
  if (isDown(world, target.id)) return false;
  const runners = hearers(ctx, target);
  if (!runners.length) return false;
  for (const q of runners) {
    stopFor(ctx, q, false);
    q['doing'] = 'answer';
    walkTo(ctx, q, spotOf(target));
  }
  const species = content.wild.predators.find((p) => p.kind === wolf['kind'])!.name;
  const line = ctx.emit('wild.cry', {
    causes: [cause].filter((c) => c > 0),
    actors: [target.id, ...runners.map((q) => q.id)],
    data: {
      name: target['name'] as string,
      species,
      them: pronouns(target).them,
      why,
      names: list(runners.map((q) => q['name'] as string)),
    },
  });
  Object.assign(state, {
    fWolf: wolf.id,
    fTarget: target.id,
    fUntil: world.tick + content.wild.folk.cry.minutes,
    fCry: line,
    fFled: target['doing'] === 'flee' ? 1 : 0,
    fX: target['x'] as number,
    fY: target['y'] as number,
    fWx: wolf['x'] as number,
    fWy: wolf['y'] as number,
  });
  Object.assign(target, { doing: 'held', path: [], stride: 0 });
  return true;
}

/** One runner's minute: beside the one held they wait; else they run on. */
function run(ctx: SystemContext, q: EntityRow, target: EntityRow): void {
  const folk = ctx.content.wild.folk;
  if (cheb(spotOf(q), spotOf(target)) <= folk.beside) {
    q['path'] = [];
    return;
  }
  stepAlong(ctx, q);
  if (!(q['path'] as number[]).length) walkTo(ctx, q, spotOf(target));
}

/**
 * Each minute of a fight under way: the wolf and the one held stay put, runners run, and when
 * the time is up `fight` is fought (the target fleeing again if they were). Always ends the
 * minute's attacks.
 */
export function cryMinute(
  ctx: SystemContext,
  fight: (wolf: EntityRow, target: EntityRow) => void,
): void {
  const { world, state } = ctx;
  const wolf = animalsOf(world).find((a) => a.id === state['fWolf']);
  const target = people(world).find((p) => p.id === state['fTarget'] && p['status'] === 'alive');
  const runners = people(world).filter((q) => q['doing'] === 'answer');
  if (wolf && target) {
    Object.assign(wolf, { x: state['fWx'], y: state['fWy'], path: [] });
    Object.assign(target, { x: state['fX'], y: state['fY'], path: [] });
    if (world.tick < state['fUntil']!) {
      for (const q of runners) run(ctx, q, target);
      return;
    }
    const folk = ctx.content.wild.folk;
    for (const q of runners)
      if (cheb(spotOf(q), spotOf(target)) <= folk.beside)
        addMemory(ctx, q.id, folk.memories.stood, state['fCry']!);
    target['doing'] = state['fFled'] ? 'flee' : '';
    fight(wolf, target);
  } else if (target?.['doing'] === 'held') target['doing'] = '';
  for (const q of runners) Object.assign(q, { doing: '', path: [] });
  for (const k of KEYS) state[k] = 0;
}
