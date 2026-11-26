// Asks (6C Slice 3, V-225): the lord, and later neighbours, guests, the shrine and dreams, ask the
// colony for something, each citing the line it came from. The colony answers as a colony, never
// a person (V-041): it takes an ask up at a priority of 1 to 4, or lets it pass. A taken-up ask is
// work (crafts askwork.ts); what it wants is set apart in the tithe barn (goods asks.ts). On its day
// the asker's side settles it: done, late, or passed, each a line; what that costs is theirs.
import type { EntityRow, GoodAskDef } from '../core/index.ts';
import { addEntity, alive } from '../entity/index.ts';
import { barnSpot } from '../build/index.ts';
import { emptyAsk, foodDays, heldOf, layItem, layTool, restOf } from '../goods/index.ts';
import { bookName, keptBooks } from '../teach/index.ts';
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
  /** The tick it is due by; 0 for the asker's next coming (the lord's visit, a harvest home). */
  due: number;
  /** Whose it is among its kind: a village's name, a creed's row id. */
  of?: string;
}

/** What content ask `def` wants, now: its tool or goods, quality, and how many (a `share` in 100
 * of the food in store, at least one). */
export function wantsOf(
  ctx: SystemContext,
  def: GoodAskDef,
): Pick<NewAsk, 'what' | 'tool' | 'good' | 'quality' | 'count'> {
  const { world, content } = ctx;
  const store = def.count ? 0 : foodDays(world, content, alive(world).length).food;
  return {
    what: def.what,
    count: def.count ?? Math.max(1, Math.ceil((store * (def.share ?? 0)) / 100)),
    ...(def.tool && { tool: def.tool }),
    ...(def.good && { good: def.good }),
    ...(def.quality && { quality: def.quality }),
  };
}

/** Adds an open ask; returns its row. */
export function addAsk(ctx: SystemContext, a: NewAsk): EntityRow {
  const id = addEntity(ctx.world, 'ask', {
    ...{ source: a.source, asker: a.asker, what: a.what, tool: a.tool ?? '', good: a.good ?? '' },
    ...{ quality: a.quality ?? '', count: a.count, got: 0, held: '', cite: a.cite, line: a.line },
    ...{ due: a.due, state: 'open', level: 0, answer: 0, going: [], settled: 0, made: 0 },
    ...{ of: a.of ?? '', pieces: [], tried: 0 },
  });
  return ctx.world.entities['ask']!.find((r) => r.id === id)!;
}

/** What an ask held goes back to the colony: laid at the barn (a tool, or with no barn, with the
 * cart). */
export function giveBack(ctx: SystemContext, a: EntityRow, cause: number): void {
  const { world, content } = ctx;
  const at = barnSpot(world) ?? restOf(world, content);
  for (const [kind, n] of heldOf(a)) {
    const def = content.items.find((d) => d.id === kind);
    if (def?.tool)
      for (let k = 0; k < n; k += 1)
        layTool(world, content, restOf(world, content), {
          ...{ kind: def.tool.kind, material: def.tool.material, quality: 'plain', made: cause },
        });
    else layItem(world, { kind, count: n, ...at, made: cause });
  }
  emptyAsk(a);
}

const causesOf = (a: EntityRow, more: readonly number[]): number[] =>
  [a['line'] as number, a['answer'] as number, ...more].filter((l) => l > 0);

/** A taken ask for books (good `book`, 6C review q4) is met on its day from the schoolroom shelf:
 * books are table rows, not things to carry, so whoever fetches it takes the best kept books (the
 * highest level, then the oldest), each lost to the valley with a line naming it. Returns the
 * lines. */
function fromShelf(ctx: SystemContext, a: EntityRow, causes: readonly number[], who: string) {
  const { world, content } = ctx;
  if (a['good'] !== 'book' || a['state'] !== 'taken') return [];
  const best = [...keptBooks(world)].sort(
    (x, y) => (y['level'] as number) - (x['level'] as number) || x.id - y.id,
  );
  const want = Math.max(0, (a['count'] as number) - (a['got'] as number));
  return best.slice(0, want).map((book) => {
    const line = ctx.emit('ask.bookTaken', {
      causes: causesOf(a, causes),
      data: { who, book: bookName(world, content, book), asker: a['asker'] as string },
    });
    Object.assign(book, { state: 'lost', lost: line });
    a['got'] = (a['got'] as number) + 1;
    return line;
  });
}

/** Settles ask `a` on its day: done if it has all it asked for (handed over), late if taken up and
 * short (what there is is handed over; books come off the shelf, `fromShelf`), passed if let pass or never answered (anything set apart
 * goes back). The line, citing `causes` (a visit, a deadline); the cost is the asker side's. */
export function settleAsk(
  ctx: SystemContext,
  a: EntityRow,
  causes: readonly number[],
  data: Readonly<Record<string, string>> = {},
): { how: 'done' | 'late' | 'passed'; line: number } {
  const words = { what: a['what'] as string, asker: a['asker'] as string, ...data };
  causes = [...causes, ...fromShelf(ctx, a, causes, data['who'] ?? 'the asker')];
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
