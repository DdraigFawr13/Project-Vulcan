// Asks (6C Slice 3, V-225): the lord, and later neighbours, guests, the shrine and dreams, ask the
// colony for something, each citing the line it came from. The colony answers as a colony, never
// a person (V-041): it takes an ask up at a priority of 1 to 4, or lets it pass. A taken-up ask is
// work (crafts askwork.ts); what it wants is set apart in the tithe barn (goods asks.ts). On its day
// the asker's side settles it: done, late, or passed, each a line; what that costs is theirs.
import type { EntityRow } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { barnSpot } from '../build/index.ts';
import { emptyAsk, heldOf, layItem, layTool, restOf } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** A new ask, open until the colony answers it. */
export interface NewAsk {
  source: string;
  asker: string;
  what: string;
  tool?: string;
  good?: string;
  quality?: string;
  count: number;
  /** The line it came from. */
  cite: number;
  /** Its own line (the asker's words). */
  line: number;
  /** The tick it is due by; 0 for the lord's next visit. */
  due: number;
}

/** Adds an open ask; returns its row. */
export function addAsk(ctx: SystemContext, a: NewAsk): EntityRow {
  const id = addEntity(ctx.world, 'ask', {
    ...{ source: a.source, asker: a.asker, what: a.what, tool: a.tool ?? '', good: a.good ?? '' },
    ...{ quality: a.quality ?? '', count: a.count, got: 0, held: '', cite: a.cite, line: a.line },
    ...{ due: a.due, state: 'open', level: 0, answer: 0, going: [], settled: 0 },
  });
  return ctx.world.entities['ask']!.find((r) => r.id === id)!;
}

/** What an ask held goes back to the colony: laid at the barn (a tool with the cart). */
function giveBack(ctx: SystemContext, a: EntityRow, cause: number): void {
  const { world, content } = ctx;
  const at = barnSpot(world);
  for (const [kind, n] of heldOf(a)) {
    const def = content.items.find((d) => d.id === kind);
    if (def?.tool)
      for (let k = 0; k < n; k += 1)
        layTool(world, content, restOf(world, content), {
          ...{ kind: def.tool.kind, material: def.tool.material, quality: 'plain', made: cause },
        });
    else if (at) layItem(world, { kind, count: n, ...at, made: cause });
  }
  emptyAsk(a);
}

const causesOf = (a: EntityRow, more: readonly number[]): number[] =>
  [a['line'] as number, a['answer'] as number, ...more].filter((l) => l > 0);

/** Settles ask `a` on its day: done if it has all it asked for (handed over), late if taken up and
 * short (what there is is handed over), passed if let pass or never answered (anything set apart
 * goes back). The line, citing `causes` (a visit, a deadline); the cost is the asker side's. */
export function settleAsk(
  ctx: SystemContext,
  a: EntityRow,
  causes: readonly number[],
  data: Readonly<Record<string, string>> = {},
): { how: 'done' | 'late' | 'passed'; line: number } {
  const words = { what: a['what'] as string, asker: a['asker'] as string, ...data };
  const got = a['got'] as number;
  let how: 'done' | 'late' | 'passed';
  let line: number;
  if (a['state'] === 'taken' && got >= (a['count'] as number)) {
    how = 'done';
    line = ctx.emit('ask.done', { causes: causesOf(a, causes), data: words });
    emptyAsk(a);
  } else if (a['state'] === 'taken') {
    how = 'late';
    const part = got ? `; ${got} of ${a['count'] as number} were set apart and handed over` : '';
    line = ctx.emit('ask.late', { causes: causesOf(a, causes), data: { ...words, got: part } });
    emptyAsk(a);
  } else {
    how = 'passed';
    const event = a['state'] === 'passed' ? 'ask.passed' : 'ask.unanswered';
    line = ctx.emit(event, { causes: causesOf(a, causes), data: words });
    giveBack(ctx, a, line);
  }
  Object.assign(a, { state: how, settled: line, going: [] });
  return { how, line };
}
