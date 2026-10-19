// Tools in use (Bundle 3, V-088, V-041): nobody is handed a tool. Taking up work a tool serves, a
// person with none of that kind takes the best free one in the store; every minute of that work is
// counted per kind (a week's worth, decayed at midnight) and wears the tool they hold; at dawn the
// person who has worked a kind most takes a better free tool from the store, their old one going
// back. A tool at no wear left breaks. The work's minutes are divided by the tool's speed.
import { clockAt, TICKS_PER_DAY, type EngineContent, type EntityRow } from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import { freeTools, heldBy, HELD, restOf, speedOf, toolOf } from '../goods/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { dayOf } from './day.ts';
import { people, spotOf } from './spots.ts';

export const TOOL_TABLES: Schemas = {
  /** Minutes `person` has worked with a kind of tool (tools.json) over the last week, decayed at
   * midnight: "who does that work most". */
  usage: { person: 'entity', kind: 'text', minutes: 'count' },
};

const usageRows = (ctx: SystemContext): EntityRow[] => ctx.world.entities['usage'] ?? [];

/** The kind of tool that serves a piece of work (`fell`, `split`, `quarry`, `mine`, `farm`,
 * `build`, `carpentry`), if any. */
export const kindServing = (content: EngineContent, use: string) =>
  content.tools.kinds.find((k) => k.serves.includes(use));

/** The best tool of `kind` that `person` holds. */
const bestHeld = (ctx: SystemContext, person: number, kind: string): EntityRow | undefined =>
  heldBy(ctx.world, ctx.content, person)
    .filter((i) => toolOf(ctx.content, i)?.kind === kind)
    .sort((a, b) => speedOf(ctx.content, b) - speedOf(ctx.content, a) || a.id - b.id)[0];

/** The speed (per cent) `person` works at in a kind of work: their best tool of the kind the
 * work uses, else `tools.none`. */
export function toolPercent(
  ctx: Pick<SystemContext, 'world' | 'content'>,
  person: number,
  use: string,
): number {
  const { world, content } = ctx;
  const kind = kindServing(content, use);
  if (!kind) return 100;
  const best = heldBy(world, content, person)
    .filter((i) => toolOf(content, i)?.kind === kind.id)
    .reduce((n, i) => Math.max(n, speedOf(content, i)), 0);
  return best || content.tools.none;
}

/** How much faster than plain hands-and-stone `person` works at a kind of work (1 for a stone
 * tool, 0.75 with none): for mining (Bundle 2) as for felling, quarrying, farming, building,
 * carpentry and splitting. Work minutes are divided by it. */
export const toolFactor = (
  world: SystemContext['world'],
  content: EngineContent,
  person: number,
  use: string,
): number => toolPercent({ world, content }, person, use) / 100;

const nameOf = (content: EngineContent, item: EntityRow): string => {
  const def = content.items.find((i) => i.id === item['kind'])!;
  const q = item['quality'] as string;
  return `${/^[aeiou]/.test(q) ? 'an' : 'a'} ${q === 'plain' ? '' : `${q} `}${def.name}`;
};

/** A tool put back is kept with the cart again. */
function putBack(ctx: SystemContext, item: EntityRow): void {
  Object.assign(item, { owner: 0, state: '', ...restOf(ctx.world, ctx.content) });
}

/** `p` takes the tool `item`, handing back the one of its kind they hold (if any). */
export function giveTool(ctx: SystemContext, item: EntityRow, p: EntityRow, why: string): void {
  const { content } = ctx;
  const kind = toolOf(content, item)!.kind;
  const old = bestHeld(ctx, p.id, kind);
  ctx.emit('tool.taken', {
    causes: [item['made'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string, what: nameOf(content, item), why },
  });
  Object.assign(item, { owner: p.id, state: 'held', ...HELD });
  if (old) putBack(ctx, old);
}

/** A person starting work a tool serves who holds none of that kind takes the best free one
 * they can reach in the store (no walking: the store is one place). */
function equip(ctx: SystemContext, p: EntityRow, use: string): void {
  const { world, content } = ctx;
  const kind = kindServing(content, use);
  if (!kind || bestHeld(ctx, p.id, kind.id)) return;
  const item = freeTools(world, content, kind.id).find((i) =>
    canReach(content, world.map, spotOf(p), spotOf(i)),
  );
  if (item) giveTool(ctx, item, p, `they had no ${kind.name} for this work`);
}

/** Minutes of work of a kind a person with this tool does, which become fewer as it is faster. */
export function scaled(ctx: SystemContext, p: EntityRow, use: string, minutes: number): number {
  equip(ctx, p, use);
  return Math.max(1, Math.ceil((minutes * 100) / toolPercent(ctx, p.id, use)));
}

/** One minute of work with a kind of tool: counted for "who does it most", and wearing the tool
 * held, which breaks at no wear left (one notable line naming the hours worked). */
export function worked(ctx: SystemContext, p: EntityRow, use: string): void {
  const { world, content } = ctx;
  const kind = kindServing(content, use);
  if (!kind) return;
  const row = usageRows(ctx).find((r) => r['person'] === p.id && r['kind'] === kind.id);
  if (row) row['minutes'] = (row['minutes'] as number) + 1;
  else addEntity(world, 'usage', { person: p.id, kind: kind.id, minutes: 1 });
  const tool = bestHeld(ctx, p.id, kind.id);
  if (!tool) return;
  tool['worked'] = (tool['worked'] as number) + 1;
  tool['wear'] = (tool['wear'] as number) - 1;
  if ((tool['wear'] as number) > 0) return;
  ctx.emit('tool.broke', {
    causes: [tool['made'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: content.items.find((i) => i.id === tool['kind'])!.name,
      hours: Math.round((tool['worked'] as number) / 60),
    },
  });
  removeEntity(world, 'item', tool.id);
}

/** Minutes per person per kind, most first, ties by person id. */
export function mostUsed(ctx: SystemContext, kind: string): EntityRow[] {
  const alive = new Set(
    people(ctx.world)
      .filter((q) => q['status'] === 'alive')
      .map((q) => q.id),
  );
  return usageRows(ctx)
    .filter(
      (r) => r['kind'] === kind && (r['minutes'] as number) > 0 && alive.has(r['person'] as number),
    )
    .sort(
      (a, b) =>
        (b['minutes'] as number) - (a['minutes'] as number) ||
        (a['person'] as number) - (b['person'] as number),
    );
}

/** Each minute: at midnight the week's counts decay; at dawn the person who works each kind
 * most takes a better free tool of it, if the store has one. */
export function toolsDaily(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (world.tick % TICKS_PER_DAY === 0)
    for (const r of usageRows(ctx))
      r['minutes'] = Math.floor(
        ((r['minutes'] as number) * (content.tools.week - 1)) / content.tools.week,
      );
  const c = clockAt(world.tick, content.calendar);
  if (c.minute !== 0 || c.hour !== dayOf(world, content).workFrom) return;
  for (const kind of content.tools.kinds) {
    const top = mostUsed(ctx, kind.id)[0];
    const p = top && people(world).find((q) => q.id === top['person']);
    const free = freeTools(world, content, kind.id)[0];
    if (!p || !free) continue;
    const mine = bestHeld(ctx, p.id, kind.id);
    if (!mine || speedOf(content, free) > speedOf(content, mine))
      giveTool(ctx, free, p, `nobody works with the ${kind.name} as much`);
  }
}

/** Heldest tool of `kind` that `person` holds, for the smith's wants. */
export const heldSpeed = (ctx: SystemContext, person: number, kind: string): number => {
  const t = bestHeld(ctx, person, kind);
  return t ? speedOf(ctx.content, t) : 0;
};
