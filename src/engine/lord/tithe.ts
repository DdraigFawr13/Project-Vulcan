// The tithe (6C Slice 2, V-222). From the reeve's first visit the Lord law stands at Loyal and a
// share of everything brought in (goods `broughtIn`: harvests less seed, fleece, wool, ingots, iron
// things) is owed: a tenth, 15 in 100 for a greedy or cruel lord. Each hour the share the law
// carries is set due in the goods rows: Loyal all of it, Grudging half, Defiant only the shares of
// those who keep a Loyal will (and only they may carry it). At each later visit the reeve counts the
// barn against what is owed, takes what is there and writes what is short. In a lean year (the
// store holds under `lean.days` days' eating at the visit) a cautious, pious or learned lord takes half, the others
// all; either way the colony's standing falls and every grown-up remembers it against the law.
// One visit in `search` (a draw from the lord's stream) he searches the houses for goods hidden
// from the barn.
import { list, type EntityRow } from '../core/index.ts';
import { alive, removeEntity } from '../entity/index.ts';
import { builtHome, houseName } from '../build/index.ts';
import { addCause } from '../colony/index.ts';
import { grown } from '../family/index.ts';
import { foodDays, hiddenOf, titheRows } from '../goods/index.ts';
import { decree, settingOf, weigh } from '../law/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addFavour, climb, favourFor, poachTold, shareOf } from './favour.ts';
import { lordName, lordRow } from './tables.ts';

/** The lord's share in 100 of what is brought in: his temper's, as the favour ladder makes it
 * (raised, a fine owed, a free year). */
export function rateOf(ctx: SystemContext): number {
  const t = ctx.content.lord.tithe;
  const plain = t.tempers[lordRow(ctx.world)?.['temper'] as string] ?? t.rate;
  return Math.floor((plain * shareOf(ctx)) / 100);
}

const itemWord = (ctx: SystemContext, kind: string): string =>
  (ctx.content.items.find((d) => d.id === kind)?.name ?? kind).toLowerCase();

/** "40 turnips and 2 fleece", or "nothing". */
function goodsWords(ctx: SystemContext, counts: [string, number][]): string {
  const parts = counts.filter(([, n]) => n > 0).map(([k, n]) => `${n} ${itemWord(ctx, k)}`);
  return parts.length ? list(parts) : 'nothing';
}

/** The grown-ups who keep a Loyal will, weighed alone of the law in force (6C: under Defiant, they
 * carry their own share). */
function loyalHands(ctx: SystemContext): number[] {
  const { world, content } = ctx;
  const def = content.laws.laws.find((l) => l.id === content.lord.tithe.law)!;
  const loyal = def.settings.find((s) => s.id === 'loyal')!;
  const obey = content.laws.answer.obey;
  return alive(world)
    .filter((p) => grown(world, content, p) && weigh(world, content, p.id, loyal).will >= obey)
    .map((p) => p.id);
}

/** Each hour: what the Lord law carries of each kind's share is set due, less what has been
 * carried; a fetch whose hauler gave it up is let go. */
export function setDue(ctx: SystemContext): void {
  const { world, content } = ctx;
  const rows = titheRows(world);
  if (!rows.length) return;
  const s = settingOf(world, content, content.lord.tithe.law);
  const rate = rateOf(ctx);
  let share = s.tithe ?? 0;
  let by: number[] = [];
  if (s.id === 'defiant') {
    by = loyalHands(ctx);
    const grownUps = alive(world).filter((p) => grown(world, content, p)).length;
    share = grownUps ? Math.floor((100 * by.length) / grownUps) : 0;
  }
  for (const r of rows) {
    const target = Math.floor(((r['brought'] as number) * rate * share) / 10000);
    r['due'] = Math.max(0, target - (r['set'] as number));
    r['by'] = by;
    const going = (r['going'] as number[])[0];
    const p = alive(world).find((q) => q.id === going);
    if (going && (!p || p['job'] !== 'haul')) r['going'] = [];
  }
}

/** The first visit: the Lord law is set Loyal, citing the reeve's line, and everyone answers. */
export function swear(ctx: SystemContext, named: number): void {
  decree(ctx, ctx.content.lord.tithe.law, 'loyal', named);
}

/** A lean year's tithe: the standing falls, and each grown-up remembers it against the law. */
function leanYear(ctx: SystemContext, line: number): void {
  const { world, content } = ctx;
  const lean = content.lord.tithe.lean;
  addCause(ctx, 'leanTithe', lean.standing, lean.standing.text, [line]);
  for (const p of alive(world))
    if (grown(world, content, p)) addMemory(ctx, p.id, lean.memory, line);
}

/** One visit in `search`: the houses are searched and every stash from the barn still held is
 * found and taken, a line each, then one line for the search. */
function search(ctx: SystemContext, reeve: string, cause: number): void {
  const { world, content } = ctx;
  if (ctx.rng().int(content.lord.tithe.search) !== 0) return;
  const lord = lordName(lordRow(world)!);
  const found: [string, number][] = [];
  const lines: number[] = [];
  for (const h of [...hiddenOf(world)]) {
    const item = (world.entities['item'] ?? []).find(
      (i) => i.id === h['item'] && i['state'] === 'hid' && i['holder'] === h['person'],
    );
    const p = alive(world).find((q) => q.id === h['person']);
    if (!item || !p) {
      removeEntity(world, 'hidden', h.id);
      continue;
    }
    const kind = item['kind'] as string;
    const count = item['count'] as number;
    const home = builtHome(world, p.id);
    const where = home ? `in their ${houseName(world, content, home.id)}` : 'in their bedroll';
    const at = ctx.emit('lord.found', {
      causes: [cause, h['line'] as number],
      actors: [p.id],
      data: { reeve, count, what: itemWord(ctx, kind), name: p['name'] as string, where, lord },
    });
    lines.push(at);
    addFavour(ctx, 'found', [at], { what: `${count} ${itemWord(ctx, kind)}` });
    found.push([kind, count]);
    removeEntity(world, 'item', item.id);
    removeEntity(world, 'hidden', h.id);
  }
  ctx.emit('lord.searched', {
    causes: [cause, ...lines],
    data: { reeve, found: goodsWords(ctx, found) },
  });
}

/** What the favour ladder makes of this year's tithe, for the reeve's line. */
const termsOf = (lord: EntityRow): string =>
  lord['free']
    ? ', the lord granting a year free of the tithe'
    : lord['fine']
      ? ', with the fine'
      : '';

/** A later visit: the reeve counts the barn against the share of all brought in since he last
 * came, takes what is there (half, for some lords, in a lean year) and says what is short. */
export function takeTithe(ctx: SystemContext, causes: number[], to: EntityRow): number {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const rows = titheRows(world);
  const rate = rateOf(ctx);
  const lean = foodDays(world, content, alive(world).length).days < content.lord.tithe.lean.days;
  const half = lean && content.lord.tithe.lean.half.includes(lord['temper'] as string);
  const owed: [string, number][] = [];
  const there: [string, number][] = [];
  const took: [string, number][] = [];
  const brought: [string, number][] = [];
  const cites: number[] = [];
  for (const r of rows) {
    const kind = r['kind'] as string;
    const full = Math.floor(((r['brought'] as number) * rate) / 100);
    const want = half ? Math.floor(full / 2) : full;
    const barn = r['barn'] as number;
    const n = Math.min(want, barn);
    owed.push([kind, want]);
    there.push([kind, barn]);
    took.push([kind, n]);
    brought.push([kind, r['brought'] as number]);
    cites.push(...(r['lines'] as number[]));
    // What he leaves in the barn counts towards the next share, so the barn does not swell.
    Object.assign(r, {
      barn: barn - n,
      brought: 0,
      due: 0,
      set: barn - n,
      by: [],
      going: [],
      lines: [],
    });
  }
  const sum = (xs: [string, number][]) => xs.reduce((n, [, c]) => n + c, 0);
  const short: [string, number][] = owed.map(([k, n], i) => [k, n - took[i]![1]]);
  const shortN = sum(short);
  const leanWords =
    (!lean
      ? ''
      : half
        ? '; the year is lean, so the lord takes half'
        : '; the year is lean, but the lord takes all') + termsOf(lord);
  const line = ctx.emit('lord.tithed', {
    causes: [...causes, ...cites],
    actors: [to.id],
    data: {
      ...{ reeve: lord['reeve'] as string, name: to['name'] as string, lord: lordName(lord) },
      ...{
        owed: goodsWords(ctx, owed),
        share: rate === 10 ? 'a tenth' : rate ? `${rate} in 100` : 'none',
      },
      ...{ brought: goodsWords(ctx, brought), lean: leanWords, there: goodsWords(ctx, there) },
      short: shortN ? `Short: ${goodsWords(ctx, short)}.` : 'Nothing is short.',
      took: goodsWords(ctx, took),
      ...{ owedN: sum(owed), thereN: sum(there), shortN, tookN: sum(took) },
    },
  });
  if (lean && sum(took) > 0) leanYear(ctx, line);
  const words = { owed: goodsWords(ctx, owed), there: goodsWords(ctx, there) };
  favourFor(ctx, {
    line,
    owedN: sum(owed),
    shortN,
    owed,
    words: { ...words, short: goodsWords(ctx, short) },
  });
  poachTold(ctx, line);
  search(ctx, lord['reeve'] as string, line);
  climb(ctx, line, owed);
  return line;
}
