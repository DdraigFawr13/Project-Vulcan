// Tools in use (Bundle 3, V-088, V-041): nobody is handed a tool. Taking up work a tool serves, a
// person with none of that kind takes the best free one in the store; every minute of that work is
// counted per kind (a week's worth, decayed at midnight) and wears the tool they hold; at dawn the
// person who has worked a kind most takes a better free tool from the store, then the next most, each
// whose own tool is beaten by one; the old one goes to whoever holds the worst of the kind (and
// works it), else back. Hours are each person's own. A tool at no wear left breaks. The work's minutes are divided by the tool's speed.
import { clockAt, TICKS_PER_DAY, type EngineContent, type EntityRow } from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import {
  betterTool,
  freeTools,
  heldBy,
  HELD,
  isWorn,
  restOf,
  speedOf,
  toolOf,
  toolsChanged,
  wornAsk,
} from '../goods/index.ts';
import { hoursOf } from '../law/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
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
  const what = `${q === 'plain' ? '' : `${q} `}${def.name}`;
  return `${/^[aeiou]/.test(what) ? 'an' : 'a'} ${what}`;
};

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** A tool put back is kept with the cart again. */
function putBack(ctx: SystemContext, item: EntityRow): void {
  Object.assign(item, { owner: 0, state: '', ...restOf(ctx.world, ctx.content) });
  toolsChanged(ctx.world);
}

/** What a tool's line cites: the line that made it, else (a tool with none) its holder's arrival. */
const causesOf = (item: EntityRow, p: EntityRow): number[] =>
  [item['made'] as number, p['arrived'] as number].filter((l) => l > 0).slice(0, 1);

type Heir = { person: EntityRow; theirs: EntityRow | undefined };

/** Who a tool just put down goes to: among those who work its kind, the one whose held tool of it
 * is worst (none is worse than any) and beaten by it; most minutes first among equals. */
function heirOf(ctx: SystemContext, old: EntityRow, giver: number, kind: string): Heir | undefined {
  let heir: Heir | undefined;
  for (const row of mostUsed(ctx, kind)) {
    const person = people(ctx.world).find((q) => q.id === row['person']);
    if (!person || person.id === giver) continue;
    const theirs = bestHeld(ctx, person.id, kind);
    if (theirs && !betterTool(ctx.content, old, theirs)) continue;
    if (!heir || (heir.theirs && (!theirs || betterTool(ctx.content, heir.theirs, theirs))))
      heir = { person, theirs };
  }
  return heir;
}

/** `p` takes the tool `item`, handing back the one of its kind they hold (if any); with `down`,
 * that old one goes to whoever holds the worst of the kind, if it is better than theirs. */
export function giveTool(
  ctx: SystemContext,
  item: EntityRow,
  p: EntityRow,
  why: string,
  down = false,
): void {
  const { content } = ctx;
  const kind = toolOf(content, item)!.kind;
  const old = bestHeld(ctx, p.id, kind);
  const heir = old && down ? heirOf(ctx, old, p.id, kind) : undefined;
  const line = ctx.emit('tool.taken', {
    causes: causesOf(item, p),
    actors: [p.id],
    data: {
      ...{ name: p['name'] as string, what: nameOf(content, item), why },
      back: old && !heir ? ` ${cap(nameOf(content, old))} went back to the cart.` : '',
    },
  });
  Object.assign(item, { owner: p.id, state: 'held', ...HELD });
  toolsChanged(ctx.world);
  if (!old) return;
  if (!heir) return putBack(ctx, old);
  const { person, theirs } = heir;
  ctx.emit('tool.handedDown', {
    causes: [line],
    actors: [p.id, person.id],
    data: {
      ...{ name: p['name'] as string, to: person['name'] as string },
      what: nameOf(content, old).replace(/^an? /, 'their '),
      why: theirs
        ? `whose ${nameOf(content, theirs).replace(/^an? /, '')} was ${isWorn(content, theirs) ? 'worn' : 'the poorer'}`
        : `who had no ${content.tools.kinds.find((k) => k.id === kind)!.name}`,
      back: theirs ? ` ${cap(nameOf(content, theirs))} went back to the cart.` : '',
    },
  });
  Object.assign(old, { owner: person.id });
  if (theirs) putBack(ctx, theirs);
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
  if (!tool['worn']) wornLine(ctx, p, tool);
  if ((tool['wear'] as number) > 0) return;
  ctx.emit('tool.broke', {
    causes: causesOf(tool, p),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: content.items.find((i) => i.id === tool['kind'])!.name,
      hours: Math.round((tool['worked'] as number) / 60),
    },
  });
  removeEntity(world, 'item', tool.id);
  toolsChanged(world);
}

/** Once, when a held tool wears under its worn line: the better one it asks for and its ingots,
 * which the smelter, miners and smith then work to fill (Morgan's card, P4.9). */
function wornLine(ctx: SystemContext, p: EntityRow, tool: EntityRow): void {
  const { content } = ctx;
  const t = content.items.find((i) => i.id === tool['kind'])!;
  const next = wornAsk(content, tool);
  if (!t.tool || !next?.ingot) return;
  const kind = content.tools.kinds.find((k) => k.id === t.tool!.kind)!;
  const ingot = content.items.find((i) => i.id === next.ingot)?.name ?? next.ingot;
  tool['worn'] = ctx.emit('tool.worn', {
    causes: causesOf(tool, p),
    actors: [p.id],
    data: {
      ...{ name: p['name'] as string, what: t.name, better: next.name, kind: kind.name },
      ...{ ingots: kind.ingots, ingot },
    },
  });
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

/** Each minute: at midnight the week's counts decay; at the hour work starts for someone (their
 * own hours, the law's or the custom), each of them who works a kind, most first, takes the best
 * free tool of it if it beats theirs, the store permitting. */
export function toolsDaily(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (world.tick % TICKS_PER_DAY === 0)
    for (const r of usageRows(ctx))
      r['minutes'] = Math.floor(
        ((r['minutes'] as number) * (content.tools.week - 1)) / content.tools.week,
      );
  const c = clockAt(world.tick, content.calendar);
  if (c.minute !== 0) return;
  for (const kind of content.tools.kinds) {
    for (const row of mostUsed(ctx, kind.id)) {
      const p = people(world).find((q) => q.id === row['person']);
      if (!p || hoursOf(world, content, p.id).workFrom !== c.hour) continue;
      const free = freeTools(world, content, kind.id)[0];
      const mine = bestHeld(ctx, p.id, kind.id);
      if (free && (!mine || betterTool(content, free, mine)))
        giveTool(ctx, free, p, `a better ${kind.name} lay at the cart`, true);
    }
  }
}

/** Speed of the best tool of `kind` that `person` holds (0 for none), quality included. */
export const heldSpeed = (ctx: SystemContext, person: number, kind: string): number => {
  const t = bestHeld(ctx, person, kind);
  return t ? speedOf(ctx.content, t) : 0;
};

/** Speed of the tool's material alone, quality left out (0 if it is not a tool). */
export const materialSpeed = (content: EngineContent, item: EntityRow): number =>
  content.tools.materials.find((m) => m.id === toolOf(content, item)?.material)?.speed ?? 0;

/** The best material (its speed) among the tools of `kind` that `person` holds; 0 for none. */
export const heldMaterial = (ctx: SystemContext, person: number, kind: string): number =>
  Math.max(
    0,
    ...heldBy(ctx.world, ctx.content, person)
      .filter((i) => toolOf(ctx.content, i)?.kind === kind)
      .map((i) => materialSpeed(ctx.content, i)),
  );
