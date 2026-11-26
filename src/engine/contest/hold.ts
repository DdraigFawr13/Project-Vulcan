// The harvest-home contests (6C Slice 7 part 3, V-236, V-241): once the harvest-home supper is
// eaten, the valley holds a contest drawn from what it does (the trial of strength always, the
// ploughing match once a field is laid out, the judging of the ale once a cask is brewed), two when
// the lord sits at the supper, the last of them his. Each grown-up at the supper stands up or not
// by their traits (a rival standing, a past win of it, push them on); the best score wins (skill,
// attribute and a roll). The winner is proud, the rest sour; a third win of one contest gives its
// byname; one beaten twice by the same winner holds them a rival. Nobody is picked (V-041).
import { list, type EntityRow, type ContestKindDef } from '../core/index.ts';
import { addEntity, alive } from '../entity/index.ts';
import { grown } from '../family/index.ts';
import { liveFields } from '../build/index.ts';
import { kegsOf } from '../inn/index.ts';
import { isDown } from '../health/index.ts';
import { skillOf } from '../band/index.ts';
import { addMemories, addMemory } from '../needs/index.ts';
import { bestow, bynameOf, freeWord } from '../tales/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { contestsAt, contestsOf, rivals } from './tables.ts';

const TIMES = ['', 'once', 'twice', 'three times', 'four times', 'five times'];

/** The contests the valley can hold now, in content order. */
function canHold(ctx: SystemContext): ContestKindDef[] {
  const { world, content } = ctx;
  const does: Readonly<Record<string, boolean>> = {
    none: true,
    field: liveFields(world).length > 0,
    brewer: kegsOf(world).length > 0,
  };
  return content.contests.kinds.filter((k) => does[k.needs]);
}

/** `n` contests drawn from those the valley can hold, those not held at the last harvest home
 * first. */
function draw(ctx: SystemContext, feast: number, n: number): ContestKindDef[] {
  const before = contestsOf(ctx.world).filter((c) => (c['feast'] as number) < feast);
  const lastFeast = before.at(-1)?.['feast'];
  const last = new Set(before.filter((c) => c['feast'] === lastFeast).map((c) => c['kind']));
  const pool = canHold(ctx);
  const picks: ContestKindDef[] = [];
  while (picks.length < n && pool.length) {
    const fresh = pool.filter((k) => !last.has(k.id));
    const from = fresh.length ? fresh : pool;
    const k = from[ctx.rng().int(from.length)]!;
    picks.push(k);
    pool.splice(pool.indexOf(k), 1);
  }
  return picks;
}

const traitsOf = (ctx: SystemContext, p: EntityRow): string[] =>
  (ctx.world.entities['trait'] ?? [])
    .filter((t) => t['person'] === p.id)
    .map((t) => t['trait'] as string);

const winsOf = (ctx: SystemContext, p: number, kind: string): number =>
  contestsOf(ctx.world).filter((c) => c['winner'] === p && c['kind'] === kind).length;

/** In 100, whether `p` stands up for `k` among `able`. */
function chance(ctx: SystemContext, p: EntityRow, k: ContestKindDef, able: EntityRow[]): number {
  const e = ctx.content.contests.enter;
  const traits = traitsOf(ctx, p).reduce((n, t) => n + (e.traits[t] ?? 0), 0);
  const rival = able.some((q) => q.id !== p.id && rivals(ctx.world, p.id, q.id)) ? e.rival : 0;
  const won = winsOf(ctx, p.id, k.id) > 0 ? e.won : 0;
  return e.base + traits + rival + won;
}

/** A contestant's score: skill level, attribute and a roll. */
function score(ctx: SystemContext, p: EntityRow, k: ContestKindDef): number {
  const skill = k.skill ? skillOf(ctx.world, p, k.skill) : 0;
  return skill + ((p[k.attribute] as number) || 0) + ctx.rng().int(ctx.content.contests.roll + 1);
}

/** A third win of one contest names the winner, unless they have a byname. */
function maybeByname(ctx: SystemContext, w: EntityRow, k: ContestKindDef, line: number): void {
  const wins = winsOf(ctx, w.id, k.id);
  if (wins !== ctx.content.contests.wins || bynameOf(ctx.world, w.id)) return;
  const first = w['sex'] === 'm' && k.m ? k.m : k.byname;
  const word = freeWord(ctx, [first, ...k.spares]);
  if (!word) return;
  const name = w['name'] as string;
  bestow(ctx, w, word, `${name} has won ${k.name} ${TIMES[wins] ?? `${wins} times`}.`, line);
}

/** Each beaten by the winner `beaten` times holds them a rival, once. */
function maybeRivals(ctx: SystemContext, w: EntityRow, lost: EntityRow[], line: number): void {
  const c = ctx.content.contests;
  for (const l of lost) {
    const times = contestsOf(ctx.world).filter(
      (x) => x['winner'] === w.id && (x['entered'] as number[]).includes(l.id),
    ).length;
    if (times !== c.beaten || rivals(ctx.world, l.id, w.id)) continue;
    const said = ctx.emit('contest.rival', {
      causes: [line],
      actors: [l.id, w.id],
      data: { name: l['name'] as string, other: w['name'] as string },
    });
    addEntity(ctx.world, 'rival', { person: l.id, of: w.id, line: said });
    addMemory(ctx, l.id, c.memories.rival, said, w.id);
  }
}

/** Holds contest `k` among `there` at supper `f`, unless too few stand up. */
function holdOne(
  ctx: SystemContext,
  f: EntityRow,
  k: ContestKindDef,
  there: EntityRow[],
  lord: { here: boolean; his: boolean },
): void {
  const c = ctx.content.contests;
  const able = there.filter((p) => !k.skill || skillOf(ctx.world, p, k.skill) >= (k.least ?? 0));
  const odds = able.map((p) => chance(ctx, p, k, able));
  const entered = able.filter((_, i) => ctx.rng().int(100) < odds[i]!);
  if (entered.length < c.least) return;
  const ranked = entered
    .map((p) => ({ p, s: score(ctx, p, k) }))
    .sort((a, b) => b.s - a.s || a.p.id - b.p.id)
    .map((x) => x.p);
  const [w, ...lost] = ranked as [EntityRow, ...EntityRow[]];
  const line = ctx.emit('contest.held', {
    causes: [f['eaten'] as number, f['line'] as number].filter((n) => n > 0),
    actors: ranked.map((p) => p.id),
    data: {
      ...{ count: String(ranked.length), contest: k.name, name: w['name'] as string, won: k.won },
      others: list(lost.map((p) => p['name'] as string)),
      lord: lord.here ? " The lord's party watched." : '',
    },
  });
  addEntity(ctx.world, 'contest', {
    ...{ kind: k.id, year: f['year'] as number, feast: f.id, winner: w.id },
    ...{ entered: ranked.map((p) => p.id), line, lord: lord.his ? 1 : 0 },
  });
  addMemory(ctx, w.id, c.memories.won, line);
  addMemories(
    ctx,
    lost.map((p) => p.id),
    c.memories.lost,
    line,
    w.id,
  );
  maybeByname(ctx, w, k, line);
  maybeRivals(ctx, w, lost, line);
}

/** The contests of harvest-home supper `f`, just eaten; `lordHere` when the lord sits at it. */
export function holdContests(ctx: SystemContext, f: EntityRow, lordHere: boolean): void {
  const { world, content } = ctx;
  if (contestsAt(world, f.id).length) return;
  const ids = new Set((f['there'] as number[]) ?? []);
  const there = alive(world).filter(
    (p) =>
      ids.has(p.id) &&
      grown(world, content, p) &&
      !isDown(world, p.id) &&
      !((p['waits'] as number) > 0),
  );
  const kinds = draw(ctx, f.id, lordHere ? content.contests.lord : content.contests.each);
  kinds.forEach((k, i) =>
    holdOne(ctx, f, k, there, { here: lordHere, his: lordHere && i === kinds.length - 1 }),
  );
}
