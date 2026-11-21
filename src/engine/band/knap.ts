// Needed tools and knapping (Seen at work Part 2, V-190, V-195, V-041). Some work is not taken up
// without a tool of its kind (tools.json `needed`): a person with none takes a free one at the
// cart, else their want is noted and they knap their own stone one if they have some crafting
// skill, else do other work. The Toolmaking row knaps for whoever else waits. When none of a kind
// is left in the valley one line says so, until there is one again. Nobody is told to knap.
import { streamFor, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import { qualityOf } from '../build/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import { freeTools, layTool, restOf } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fetchKind, reachableOf, useHeld } from './fetch.ts';
import { practise } from './learn.ts';
import { priorityLine } from './priority.ts';
import { people, skillOf } from './spots.ts';
import { bestHeld, equip, giveTool, toolsOfKind } from './tools.ts';

export const KNAP_TABLES: Schemas = {
  /** `person` would have taken up work that needs a tool of `kind` and had none, at `tick`. */
  toolWant: { person: 'entity', kind: 'text', tick: 'count' },
};

type Kind = EngineContent['tools']['kinds'][number];

/** A want older than this is let go: they found other work. */
const STALE = 1440;

const wantsOf = (world: WorldState): EntityRow[] => world.entities['toolWant'] ?? [];

/** The kind of tool `use` cannot be done without (tools.json `needed`), if any. */
export const neededKind = (content: EngineContent, use: string): Kind | undefined =>
  content.tools.kinds.find((k) => k.needed?.includes(use));

/** The Work row a needed use belongs to (`split` is Tend's). */
const rowOf = (content: EngineContent, use: string): string => content.tools.knap.rows[use] ?? use;

const kindName = (content: EngineContent, kind: string): string =>
  content.tools.kinds.find((k) => k.id === kind)?.name ?? kind;

/** What `p` would do: `ok` when the work needs no tool or they hold or take one; `knap` when they
 * have none and took up knapping their own; `none` when they must do other work. */
export type Ready = 'ok' | 'knap' | 'none';

/** Whether `p` can take up `use` now (V-195). Without a tool of its needed kind, their want is
 * noted, a line says so if none is left in the valley, and they knap their own if they can. */
export function readyFor(ctx: SystemContext, p: EntityRow, use: string): Ready {
  const kind = neededKind(ctx.content, use);
  if (!kind) return 'ok';
  equip(ctx, p, use);
  if (bestHeld(ctx, p.id, kind.id)) return 'ok';
  noteWant(ctx, p, kind.id);
  sayNone(ctx, p, kind, use);
  return knapFor(ctx, p, p, kind.id) ? 'knap' : 'none';
}

/** Whether `p` holds or could take a tool `use` needs (no side effects: for choosing work). */
export function couldHave(ctx: SystemContext, p: EntityRow, use: string): boolean {
  const kind = neededKind(ctx.content, use);
  return (
    !kind || !!bestHeld(ctx, p.id, kind.id) || freeTools(ctx.world, ctx.content, kind.id).length > 0
  );
}

/** `p` would take up `use` and cannot have a tool for it: their want is noted (with the line if
 * none is left in the valley) so the Toolmaking row knaps one, without their knapping it themself
 * (for work taken up out of hours, such as splitting firewood). While every one is held, only
 * when nobody else waits for one, so splitting does not knap an axe for everyone. */
export function wantTool(ctx: SystemContext, p: EntityRow, use: string): void {
  const { world, content } = ctx;
  const kind = neededKind(content, use);
  if (!kind || couldHave(ctx, p, use)) return;
  const fresh = (w: EntityRow) => world.tick - (w['tick'] as number) <= STALE;
  const waiting = wantsOf(world).some((w) => w['kind'] === kind.id && fresh(w));
  if (waiting && toolsOfKind(world, content, kind.id).length) return;
  noteWant(ctx, p, kind.id);
  sayNone(ctx, p, kind, use);
}

function noteWant(ctx: SystemContext, p: EntityRow, kind: string): void {
  const row = wantsOf(ctx.world).find((r) => r['person'] === p.id && r['kind'] === kind);
  if (row) row['tick'] = ctx.world.tick;
  else addEntity(ctx.world, 'toolWant', { person: p.id, kind, tick: ctx.world.tick });
}

/** One line when someone would take up work and no tool of its kind is left in the valley; said
 * again only after one has been had (the last one breaking says it first, tools.ts). */
function sayNone(ctx: SystemContext, p: EntityRow, kind: Kind, use: string): void {
  const key = `none.${kind.id}`;
  if (toolsOfKind(ctx.world, ctx.content, kind.id).length) {
    ctx.state[key] = 0;
    return;
  }
  if (ctx.state[key]) return;
  const job = ctx.content.jobs.find((j) => j.id === rowOf(ctx.content, use));
  ctx.state[key] = ctx.emit('tool.none', {
    causes: [p['arrived'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string, work: (job?.name ?? use).toLowerCase(), kind: kind.name },
  });
}

/** The line that says the kind is wanted: the last one breaking, or none in the valley. */
const wantLine = (ctx: SystemContext, kind: string): number =>
  (ctx.state[`none.${kind}`] as number | undefined) ?? 0;

/** Whether `p` has some skill at the knapping job. */
const canKnap = (ctx: SystemContext, p: EntityRow): boolean => {
  const job = ctx.content.jobs.find((j) => j.id === ctx.content.tools.knap.job);
  return !!job?.skill && skillOf(ctx.world, p, job.skill) > 0;
};

/** What a stone tool of `kind` is knapped from. */
const fromOf = (content: EngineContent, kind: string): [string, number][] =>
  Object.entries(content.tools.kinds.find((k) => k.id === kind)?.knap ?? content.tools.knap.from);

/** `p` takes up knapping a stone `kind` for `forWhom`, if they can and its stone and wood can be
 * fetched; false otherwise. */
function knapFor(ctx: SystemContext, p: EntityRow, forWhom: EntityRow, kind: string): boolean {
  const { world, content } = ctx;
  const job = content.tools.knap.job;
  if (!canKnap(ctx, p)) return false;
  if (people(world).some((q) => q.id !== p.id && q['job'] === job && q['plan'] === forWhom.id))
    return false;
  const from = fromOf(content, kind);
  const loose = content.tools.knap.loose;
  if (from.some(([item, n]) => !loose.includes(item) && reachableOf(ctx, p, item) < n))
    return false;
  const mine = forWhom.id === p.id;
  const k = kindName(content, kind);
  p['took'] = ctx.emit('work.tookUpKnapping', {
    causes: [wantLine(ctx, kind), priorityLine(world, p.id, job) ?? 0].filter((l) => l > 0),
    actors: [...new Set([p.id, forWhom.id])],
    data: {
      name: p['name'] as string,
      what: `stone ${k}`,
      who: mine ? 'themself' : (forWhom['name'] as string),
      why: `no ${k} lay free at the cart`,
    },
  });
  const skill = content.jobs.find((j) => j.id === job)?.skill ?? '';
  const level = skillOf(world, p, skill);
  const { skilled } = content.tools;
  Object.assign(p, {
    ...{ job, plan: forWhom.id, making: kind, target: -1 },
    work: Math.ceil((content.tools.knap.minutes * 2 * skilled) / (skilled + level)),
  });
  return knapping(ctx, p);
}

/** The Toolmaking row: knap a stone tool for someone who waits for one of a needed kind (their
 * want is fresh, they hold none and none lies free), the longest waiting first. */
export function takeUpKnapping(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (!canKnap(ctx, p)) return false;
  const job = content.tools.knap.job;
  const alive = new Map(
    people(world)
      .filter((q) => q['status'] === 'alive')
      .map((q) => [q.id, q]),
  );
  const making = new Set(people(world).flatMap((q) => (q['job'] === job ? [q['plan']] : [])));
  for (const w of [...wantsOf(world)].sort(
    (a, b) => (a['tick'] as number) - (b['tick'] as number),
  )) {
    const who = alive.get(w['person'] as number);
    const kind = w['kind'] as string;
    if (!who || world.tick - (w['tick'] as number) > STALE) {
      removeEntity(world, 'toolWant', w.id);
      continue;
    }
    if (making.has(who.id) || bestHeld(ctx, who.id, kind)) continue;
    if (freeTools(world, content, kind).length) continue;
    if (knapFor(ctx, p, who, kind)) return true;
  }
  return false;
}

const stop = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, making: '' });
  return false;
};

/** One minute of knapping: fetch the stone and wood, then work where they stand (at the log
 * stack the wood came from); done, the tool lies with the cart and whoever it is for takes it. */
export function knapping(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const kind = p['making'] as string;
  const from = fromOf(content, kind);
  for (const [item, n] of from) {
    const got = fetchKind(ctx, p, item, n);
    // A loose stone is picked up where they stand when none lies in the stores.
    if (got === 'none' && content.tools.knap.loose.includes(item)) continue;
    if (got === 'none') return stop(p);
    if (got === 'walking') return true;
  }
  const skill = content.jobs.find((j) => j.id === content.tools.knap.job)?.skill ?? '';
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skill, p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  for (const [item, n] of from) useHeld(ctx, p, item, n);
  knapped(ctx, p, kind, skillOf(world, p, skill));
  return stop(p);
}

/** The tool is made: a line, it lies with the cart, and whoever it was for takes it if they
 * still have none of the kind. */
function knapped(ctx: SystemContext, p: EntityRow, kind: string, level: number): void {
  const { world, content } = ctx;
  const t = content.tools;
  const word = qualityOf(content, level + streamFor(world, t.knap.stream).between(-t.roll, t.roll));
  const forWhom = people(world).find((q) => q.id === p['plan']) ?? p;
  const def = content.items.find((i) => i.tool?.kind === kind && i.tool.material === 'stone')!;
  const what = `${word.id === 'plain' ? '' : `${word.word} `}${def.name}`;
  const line = ctx.emit('tool.knapped', {
    causes: [p['took'] as number],
    actors: [...new Set([p.id, forWhom.id])],
    data: {
      name: p['name'] as string,
      what: `${/^[aeiou]/.test(what) ? 'an' : 'a'} ${what}`,
      who: forWhom.id === p.id ? 'themself' : (forWhom['name'] as string),
    },
  });
  const item = layTool(world, content, restOf(world, content), {
    ...{ kind, material: 'stone', quality: word.id, made: line },
    trail: '',
  });
  for (const w of wantsOf(world).filter((r) => r['person'] === forWhom.id && r['kind'] === kind))
    removeEntity(world, 'toolWant', w.id);
  if (forWhom['status'] === 'alive' && !bestHeld(ctx, forWhom.id, kind))
    giveTool(ctx, item, forWhom, 'it was knapped for them');
}

/** What a Work row waits on, for the sheet (V-195): no tool of a kind its work needs left in the
 * valley, or every one held while someone waits for one. */
export function toolWaits(world: WorldState, content: EngineContent, job: string): string {
  for (const kind of content.tools.kinds) {
    if (!kind.needed?.some((use) => rowOf(content, use) === job)) continue;
    if (!toolsOfKind(world, content, kind.id).length) return `no ${kind.name} in the valley`;
    const waiting = wantsOf(world).some(
      (w) => w['kind'] === kind.id && world.tick - (w['tick'] as number) <= STALE,
    );
    if (waiting && !freeTools(world, content, kind.id).length)
      return `every ${kind.name} is in use`;
  }
  return '';
}
