// Courtship and weddings (P6.1, V-053, V-161). Each day at family.json `hour`: two who may court
// and have grown close enough (`court.from`) court, the closest pairs first and each person with
// one at a time; a courtship that fades to `court.part` ends; after `court.days` days the two wed.
// A wedding sets them as partners (one household), gives both the wedding memory, calls a feast
// round the fire on the green that evening while the store can spare it, and settles their home:
// the older of their homes if they have any (the other stands free), else the house wants that
// exist (V-053) plan one for them. Nobody is ordered to marry (V-161): there is no lever.
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { callWedding, feastOf, homeFor, whoseOf } from '../build/index.ts';
import { personOf, alive } from '../entity/index.ts';
import { foodDays } from '../goods/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { dayTogether, mayCourt, sharedTraits } from './close.ts';
import { bondsOf, courtingOf, nameOf } from './tables.ts';

/** The newest telling between two, the line a courtship cites; 0 for none. */
function lastTold(ctx: SystemContext, a: number, b: number): number {
  let line = 0;
  for (const t of ctx.world.entities['tale'] ?? [])
    if ((t['teller'] === a && t['person'] === b) || (t['teller'] === b && t['person'] === a))
      line = Math.max(line, t['line'] as number);
  return line;
}

/** Two begin courting. */
function court(ctx: SystemContext, r: EntityRow, p: EntityRow, q: EntityRow): void {
  const { world, content } = ctx;
  const words = content.family.words;
  const shared = sharedTraits(world, p.id, q.id) > 0;
  const told = lastTold(ctx, p.id, q.id);
  const parts = [words.together, ...(shared ? [words.alike] : []), ...(told ? [words.tales] : [])];
  const why = `they ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)!}` : parts[0]!}`;
  const line = ctx.emit('family.courting', {
    // With no tale between them, the closeness goes back to their coming to the valley.
    causes: told ? [told] : [p['arrived'] as number, q['arrived'] as number].filter((l) => l > 0),
    actors: [p.id, q.id],
    data: { a: nameOf(p), b: nameOf(q), why },
  });
  Object.assign(r, { state: 'courting', since: ctx.world.tick, line });
}

/** Where the wed will live, in words, settling their homes: a built home before a planned one,
 * the older of two alike, else a want for one of their own. Called before they are partners. */
function settleHome(
  ctx: SystemContext,
  p: EntityRow,
  q: EntityRow,
): { words: string; want: boolean } {
  const { world, content } = ctx;
  const words = content.family.words;
  const homes = [homeFor(world, p.id), homeFor(world, q.id)].filter((h): h is EntityRow => !!h);
  if (!homes.length) return { words: words.want, want: true };
  const built = (h: EntityRow) => (h['state'] === 'built' ? 0 : 1);
  const keep = homes.sort((a, b) => built(a) - built(b) || a.id - b.id)[0]!;
  const whose = whoseOf(world, [keep['owner'] as number]);
  for (const h of homes) if (h !== keep) h['owner'] = 0;
  return { words: words.live.replace('{whose}', whose), want: false };
}

/** Two wed: partners, the memory, the feast, the home. False when a supper is already called
 * tonight (the wedding waits a day). */
function wed(ctx: SystemContext, r: EntityRow, p: EntityRow, q: EntityRow): boolean {
  const { world, content } = ctx;
  if (feastOf(world)) return false;
  const home = settleHome(ctx, p, q);
  const days = Math.floor((world.tick - (r['since'] as number)) / TICKS_PER_DAY);
  const line = ctx.emit('family.wed', {
    causes: [r['line'] as number],
    actors: [p.id, q.id],
    data: { a: nameOf(p), b: nameOf(q), days, home: home.words },
  });
  [p['partner'], q['partner']] = [q.id, p.id];
  Object.assign(r, { state: 'wed', since: world.tick, line });
  for (const [x, y] of [
    [p, q],
    [q, p],
  ] as const) {
    addMemory(ctx, x.id, content.family.memories.wed, line, y.id);
    if (!home.want) continue;
    const from = x['wantsFrom'] as number;
    Object.assign(x, { wantsFrom: from && from < world.tick ? from : world.tick, wants: line });
  }
  const spare = foodDays(world, content, alive(world).length).days >= content.family.feastDays;
  if (spare) callWedding(ctx, line, [p.id, q.id]);
  else
    ctx.emit('family.noFeast', {
      causes: [line],
      actors: [p.id, q.id],
      data: { a: nameOf(p), b: nameOf(q) },
    });
  return true;
}

/** A courtship moves on: ended by death or a lost partner quietly, by fading with a line, or
 * a wedding once its days are up. */
function goOn(ctx: SystemContext, r: EntityRow): void {
  const { world, content } = ctx;
  const p = personOf(world, r['a']);
  const q = personOf(world, r['b']);
  if (!p || !q || !mayCourt(world, content, p, q)) {
    Object.assign(r, { state: '', since: 0, line: 0 });
    return;
  }
  if ((r['close'] as number) <= content.family.court.part) {
    ctx.emit('family.parted', {
      causes: [r['line'] as number],
      actors: [p.id, q.id],
      data: { a: nameOf(p), b: nameOf(q) },
    });
    Object.assign(r, { state: '', since: 0, line: 0 });
    return;
  }
  if (world.tick - (r['since'] as number) >= content.family.court.days * TICKS_PER_DAY)
    wed(ctx, r, p, q);
}

/** Each day: closeness fades and gains, courtships move on, and new ones begin. */
export function courtingDay(ctx: SystemContext): void {
  const { world, content } = ctx;
  dayTogether(world, content);
  // A marriage ended by a death is the partner field's to remember (build householdOf).
  const living = (id: unknown) => personOf(world, id)?.['status'] === 'alive';
  world.entities['bond'] = bondsOf(world).filter(
    (r) => r['state'] !== 'wed' || (living(r['a']) && living(r['b'])),
  );
  for (const r of bondsOf(world).filter((x) => x['state'] === 'courting')) goOn(ctx, r);
  const ready = bondsOf(world)
    .filter((r) => !r['state'] && (r['close'] as number) >= content.family.court.from)
    .sort((a, b) => (b['close'] as number) - (a['close'] as number) || a.id - b.id);
  for (const r of ready) {
    const [a, b] = [r['a'] as number, r['b'] as number];
    if (courtingOf(world, a) || courtingOf(world, b)) continue;
    const p = personOf(world, a);
    const q = personOf(world, b);
    if (p && q && mayCourt(world, content, p, q)) court(ctx, r, p, q);
  }
}
