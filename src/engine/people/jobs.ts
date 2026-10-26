// Work (P2.4): nobody is told what to do (V-015). In working hours a free person looks at what
// the colony wants and takes something up themselves: under the wood stock level, someone able to
// fell (jobs.json `fell`) picks a tree (a fallen log first, then the standing one nearest the
// store, never close to the camp) and leaves the logs where it stood; anyone free carries what
// lies outside the store into it. Quarrying is felling's twin for stone. Taking up work is a line.
import { houseName } from '../build/index.ts';
import { raiseChunk } from '../map/index.ts';
import { needOf } from '../needs/index.ts';
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import {
  haveOf,
  itemsOf,
  loadOf,
  markedTree,
  stockOf,
  storeOf,
  unmark,
  wantOf,
} from '../goods/index.ts';
import { isDark, lit } from '../lamp/index.ts';
import { afterDusk, workableInDark } from './dusk.ts';
import { canReach, walkAt } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { building, takeUpBuilding } from './build.ts';
import { burying, takeUpBurial } from './burial.ts';
import { TRADE_TAKE_UP, takeUpChange, tradeWork } from './trades.ts';
import { draughtFirst, nursing, takeUpNursing } from './nurse.ts';
import { burning, takeUpCharcoal } from './charcoal.ts';
import { mining, takeUpMining } from './mine.ts';
import { cooking, takeUpCooking } from './cook.ts';
import { chandling, takeUpChandling } from './chandle.ts';
import { larderWork, LARDER_TAKE_UP } from './larder.ts';
import { MILL_TAKE_UP, millWork } from './mill.ts';
import { deliver, LOOK_AGAIN, pickUp, takeUpHauling } from './haul.ts';
import { coldHearth, hearthFirst, takeUpHearth } from './hearth.ts';
import { takeUpTending, tending } from './tend.ts';
import { furnishing, takeUpCarpentry } from './carpentry.ts';
import { farming, takeUpFarming } from './farm.ts';
import { fishing, takeUpFishing } from './fish.ts';
import { endHunt, hunting, takeUpHunting } from './hunt.ts';
import { herding, takeUpHerding } from './herd.ts';
import { foraging, takeUpForaging } from './forage.ts';
import { beekeeping, takeUpBeekeeping } from './beekeep.ts';
import { practise } from './learn.ts';
import { smelting, takeUpSmelting } from './smelt.ts';
import { stationing, takeUpStation } from './station.ts';
import { smithing, takeUpSmithing } from './smith.ts';
import { busy, goBeside, layAround, people, same, skillOf, SIDES, spotOf } from './spots.ts';
import { able, declineIfUnable, jobsInOrder, outranked, priorityLine } from './priority.ts';
import { tallyAdd } from './tally.ts';
import { scaled, worked } from './tools.ts';
import { walkTo } from './walk.ts';

/** Work that keeps what it fetched when the working day ends, instead of carrying it back. */
const HOLDS = { station: 1, charcoal: 1, smelt: 1, smith: 1, ...LARDER_TAKE_UP, ...TRADE_TAKE_UP };

/** Work that takes a feature off the map for what it yields: felling (logs) and quarrying (P3.1,
 * stone). `kinds` are the feature kinds worked, preferred in that order. */
interface Gather {
  job: 'fell' | 'quarry';
  def: { job: string; minutes: number; skilled: number; camp: number; reach: number };
  good: string;
  kinds: readonly string[];
  word: string;
}

function gatherOf(content: EngineContent, job: unknown): Gather | undefined {
  if (job === 'fell')
    return {
      job,
      def: content.work.fell,
      good: content.work.stock[0]?.good ?? 'logs',
      kinds: ['log', 'tree'],
      word: 'felling',
    };
  if (job === 'quarry')
    return {
      job,
      def: content.work.quarry,
      good: content.work.quarry.good,
      kinds: ['boulder'],
      word: 'quarrying',
    };
  return undefined;
}

/** The feature at surface tile `i` that this work takes, if any. */
function sourceAt(world: WorldState, content: EngineContent, i: number, g: Gather) {
  const f = world.map.features[i]!;
  const def = f ? content.features[f - 1] : undefined;
  return def && g.kinds.includes(def.kind) ? def : undefined;
}

/** What to work next: a fallen log before a tree, then the one nearest the store. */
function chooseSource(ctx: SystemContext, p: EntityRow, g: Gather): number | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const { reach, camp } = g.def;
  const first = storeOf(world)[0];
  const [ox, oy] = first ? [first['x'] as number, first['y'] as number] : [map.startX, map.startY];
  const taken = busy(world, p, g.job);
  const from = spotOf(p);
  let best: number | undefined;
  let score = Infinity;
  for (let y = Math.max(0, oy - reach); y <= Math.min(map.height - 1, oy + reach); y += 1)
    for (let x = Math.max(0, ox - reach); x <= Math.min(map.width - 1, ox + reach); x += 1) {
      const i = y * map.width + x;
      const def = sourceAt(world, content, i, g);
      if (!def || taken.has(i)) continue;
      if (Math.max(Math.abs(x - map.startX), Math.abs(y - map.startY)) <= camp) continue;
      const s = g.kinds.indexOf(def.kind) * 100000 + Math.max(Math.abs(x - ox), Math.abs(y - oy));
      if (s >= score) continue;
      const reachable = SIDES.some(([dx, dy]) => {
        const [sx, sy] = [x + dx, y + dy];
        if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) return false;
        if (!walkAt(content, map, 0, sy * map.width + sx)) return false;
        return canReach(content, map, from, { x: sx, y: sy, z: 0 });
      });
      if (reachable) [best, score] = [i, s];
    }
  return best;
}

/** The tree comes down (or the boulder is broken up): the feature goes, what it yields lies
 * there, one line. */
function fell(ctx: SystemContext, p: EntityRow, i: number, g: Gather): void {
  const { world, content } = ctx;
  const map = world.map;
  const def = sourceAt(world, content, i, g);
  if (!def) return;
  const [x, y] = [i % map.width, Math.floor(i / map.width)];
  const good = content.items.find((it) => it.id === def.yields)?.name ?? def.yields;
  const verb = def.kind === 'log' ? 'cut up' : def.kind === 'tree' ? 'felled' : 'broke up';
  const name = def.name.toLowerCase();
  const line = ctx.emit('work.felled', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      verb,
      what: `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`,
      count: def.amount,
      good,
    },
  });
  map.features[i] = 0;
  unmark(world, x, y);
  map.tileCauses[i] = line;
  raiseChunk(map, x, y);
  const laid = layAround(ctx, def.yields!, def.amount, { x, y, z: 0 }, line);
  if (g.job === 'fell') tallyAdd(ctx, 'felled', laid);
}

/** Felling (quarrying) is wanted when the colony has less wood (stone) than its stock level
 * asks, counting what others are already working on, so no more take it up than are needed. */
function shortOf(
  ctx: SystemContext,
  p: EntityRow,
  g: Gather,
): { have: number; want: number } | undefined {
  const { world, content } = ctx;
  const want = wantOf(world, content, g.good);
  if (want <= 0) return undefined;
  const have = haveOf(world, content, g.good);
  let coming = 0;
  for (const q of people(world))
    if (q.id !== p.id && q['job'] === g.job && (q['target'] as number) >= 0)
      coming += sourceAt(world, content, q['target'] as number, g)?.amount ?? 0;
  return have + coming < want ? { have, want } : undefined;
}

/** One minute of work for someone free; false when there is nothing for them to do. */
export function working(ctx: SystemContext, p: EntityRow, hours: boolean): boolean {
  const { world, content } = ctx;
  const map = world.map;
  // P5.13: in the work hours, by the light this work needs (outdoor work stops at dusk, the finer
  // trades need a candle burning in their room). Asked only for the work they are at.
  const can = (job: string) => hours && lit(ctx, p, job);
  // P5.4a: hunting and fishing end at dusk, wherever they have got to.
  if ((p['job'] === 'hunt' || p['job'] === 'fish') && !can(p['job'] as string)) {
    endHunt(p);
    p['path'] = [];
  }
  // Herding's dusk and dawn jobs come before whatever else a free herder is at (herd.ts).
  if (herding(ctx, p, hours)) return true;
  const walking = (p['path'] as number[]).length > 0;
  if (p['doing'] === 'work' && walking) return true;
  if (can(p['job'] as string) && tradeWork(ctx, p)) return true;
  if (p['job'] === 'build' && can('build') && building(ctx, p)) return true;
  if (p['job'] === 'mine' && can('mine') && mining(ctx, p)) return true;
  if (p['job'] === 'farm' && can('farm') && farming(ctx, p)) return true;
  if (p['job'] === 'hunt' && can('hunt') && hunting(ctx, p)) return true;
  if (p['job'] === 'fish' && can('fish') && fishing(ctx, p)) return true;
  if (p['job'] === 'carpentry' && can('carpentry') && furnishing(ctx, p)) return true;
  if (p['job'] === 'hearth' && can('hearth') && furnishing(ctx, p)) return true;
  if (p['job'] === 'beekeep' && can('beekeep') && beekeeping(ctx, p)) return true;
  if (p['job'] === 'tend' && tending(ctx, p)) return true;
  if (p['job'] === 'cook' && can('cook') && cooking(ctx, p)) return true;
  if (p['job'] === 'chandle' && can('chandle') && chandling(ctx, p)) return true;
  if ((p['job'] === 'mill' || p['job'] === 'bake') && can(p['job']) && millWork(ctx, p))
    return true;
  if (p['job'] === 'station' && can('station') && stationing(ctx, p)) return true;
  if (can(p['job'] as string) && larderWork(ctx, p)) return true;
  if (p['job'] === 'charcoal' && can('charcoal') && burning(ctx, p)) return true;
  if (p['job'] === 'smelt' && can('smelt') && smelting(ctx, p)) return true;
  if (p['job'] === 'smith' && can('smith') && smithing(ctx, p)) return true;
  // P5.6, P5.8: a burial is seen through once begun.
  if (p['job'] === 'bury' && burying(ctx, p)) return true;
  if (nursing(ctx, p, hours)) return true;
  const load = loadOf(world, p.id);
  // Out of hours HOLDS work keeps its load till morning, as does a sinker the shaft's ladder.
  if (load && !hours && p['job'] === 'mine' && p['task'] === 'sink') return false;
  if (load && !((p['job'] as string) in HOLDS)) {
    p['job'] = 'haul';
    deliver(ctx, p, load);
    return true;
  }
  if (!hours) return false;
  // After dusk only work that can be done in the dark or by light is taken up (P5.13).
  if (isDark(content, world.tick) && spotOf(p).z === 0) return afterDusk(ctx, p, takeUp);
  const target = p['target'] as number;
  const g = gatherOf(content, p['job']);
  if (g && target >= 0 && sourceAt(world, content, target, g)) {
    const [tx, ty] = [target % map.width, Math.floor(target / map.width)];
    const here = spotOf(p);
    if (here.z === 0 && Math.abs(here.x - tx) + Math.abs(here.y - ty) === 1) {
      p['work'] = (p['work'] as number) - 1;
      worked(ctx, p, g.job);
      practise(ctx, p, jobSkill(content, g), p['took'] as number);
      if ((p['work'] as number) <= 0) {
        fell(ctx, p, target, g);
        p['target'] = -1;
      }
      return true;
    }
    if (goBeside(ctx, p, tx, ty)) return true;
    p['target'] = -1;
  }
  if (p['job'] === 'forage' && target >= 0 && foraging(ctx, p)) return true;
  if (p['job'] === 'haul' && target >= 0) {
    const item = itemsOf(world).find((i) => i.id === target && !i['holder']);
    if (item && same(spotOf(item), spotOf(p))) {
      pickUp(ctx, p, item);
      p['target'] = -1;
      return true;
    }
    if (item && walkTo(ctx, p, spotOf(item))) return true;
    p['target'] = -1;
  }
  // Under its seek line, recreation beats taking up new work (P2.2): the mind lets them relax.
  const fun = needOf(world, p.id, 'recreation');
  const seek = content.life.needs.find((n) => n.id === 'recreation')?.seek ?? 0;
  if (fun && (fun['value'] as number) < seek) return false;
  if (world.tick < (p['next'] as number)) return false;
  return takeUp(ctx, p);
}

/** Chooses new work: a test-mode marked tree, then changing clothes (trades.ts), then the Work
 * sheet's kinds in their priority order (priority.ts), a cold room's hearth first; after dusk
 * only work the dark or a light allows (dusk.ts). */
function takeUp(ctx: SystemContext, p: EntityRow, dark = false): boolean {
  const { world, content } = ctx;
  if (!dark && (takeUpMarked(ctx, p, false) || draughtFirst(ctx, p) || takeUpChange(ctx, p)))
    return true;
  for (const job of hearthFirst(ctx, p, jobsInOrder(world, content, p))) {
    if (dark && !workableInDark(ctx, job)) continue;
    const before = p['took'];
    if (TAKE_UP[job]?.(ctx, p)) return true;
    // Taken up (a line said) and stopped at once: look again later, not at the next kind.
    if (p['took'] !== before) break;
  }
  // Nothing else to do: carry in the food past its plate that would spoil out there.
  if (takeUpHauling(ctx, p, true)) return true;
  p['job'] = '';
  p['target'] = -1;
  p['next'] = world.tick + LOOK_AGAIN;
  return false;
}

/** The nearest marked tree they can get beside: a test-mode order's, or (`forHouse`, P3.7) one
 * on a house's site or its way in, which is felling work in its place on the Work sheet. */
function takeUpMarked(ctx: SystemContext, p: EntityRow, forHouse: boolean): boolean {
  const { world, content } = ctx;
  if (!able(content, p, content.work.fell.job)) return false;
  const marked = markedTree(
    world,
    content,
    busy(world, p, 'fell'),
    spotOf(p),
    (x, y) => goBeside(ctx, p, x, y),
    forHouse,
  );
  if (!marked) return false;
  const site = forHouse ? houseName(world, content, marked.house) : '';
  p['took'] = ctx.emit(forHouse ? 'work.tookUpClearing' : 'work.tookUpMarked', {
    causes: [marked.line],
    actors: [p.id],
    data: { name: p['name'] as string, ...(site && { size: site }) },
  });
  return startGathering(ctx, p, marked.tree, gatherOf(content, 'fell')!);
}

/** Felling (quarrying), while the colony's wood (stone) is short of its stock level, unless
 * they are not able (and say so if the player raised it for them) or someone free puts it
 * higher. */
function takeUpGathering(ctx: SystemContext, p: EntityRow, g: Gather): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const job = g.def.job;
  const short = shortOf(ctx, p, g);
  if (!short) return false;
  if (!able(content, p, job)) {
    declineIfUnable(ctx, p, job);
    return false;
  }
  if (outranked(ctx, p, job, (q) => chooseSource(ctx, q, g) !== undefined)) return false;
  const tree = chooseSource(ctx, p, g);
  if (tree === undefined || !goBeside(ctx, p, tree % map.width, Math.floor(tree / map.width)))
    return false;
  if (p['job'] !== g.job) {
    const good = content.work.stock.find((s) => s.good === g.good)?.name ?? g.good;
    p['took'] = ctx.emit('work.tookUp', {
      // The stock level that wants it, and the priority that put them to it if the player set one.
      causes: [
        ...[
          stockOf(world, g.good)?.['line'] as number | undefined,
          priorityLine(world, p.id, job),
        ].filter((l): l is number => l !== undefined),
      ],
      actors: [p.id],
      data: { name: p['name'] as string, work: g.word, good, ...short },
    });
  }
  return startGathering(ctx, p, tree, g);
}

/** How each Work sheet kind is taken up; one with no entry (its milestone not yet in) never is. */
const TAKE_UP: Readonly<Record<string, (ctx: SystemContext, p: EntityRow) => boolean>> = {
  fell: (ctx, p) => takeUpGathering(ctx, p, gatherOf(ctx.content, 'fell')!),
  haul: takeUpHauling,
  forage: takeUpForaging,
  hunt: takeUpHunting,
  fish: takeUpFishing,
  farm: takeUpFarming,
  herd: takeUpHerding,
  build: (ctx, p) =>
    takeUpBurial(ctx, p) ||
    (coldHearth(ctx) && takeUpHearth(ctx, p)) ||
    takeUpMarked(ctx, p, true) ||
    takeUpHearth(ctx, p) ||
    takeUpStation(ctx, p) ||
    takeUpBuilding(ctx, p),
  tend: takeUpTending,
  cook: takeUpCooking,
  ...LARDER_TAKE_UP,
  ...MILL_TAKE_UP,
  carpentry: takeUpCarpentry,
  quarry: (ctx, p) => takeUpGathering(ctx, p, gatherOf(ctx.content, 'quarry')!),
  mine: takeUpMining,
  charcoal: takeUpCharcoal,
  smelt: takeUpSmelting,
  smith: takeUpSmithing,
  heal: takeUpNursing,
  chandle: takeUpChandling,
  beekeep: takeUpBeekeeping,
  ...TRADE_TAKE_UP,
};

const jobSkill = (content: EngineContent, g: Gather): string =>
  content.jobs.find((j) => j.id === g.def.job)?.skill ?? '';

/** Sets them working the feature at surface tile `tree` (they are already on their way to it). */
function startGathering(ctx: SystemContext, p: EntityRow, tree: number, g: Gather): boolean {
  const level = skillOf(ctx.world, p, jobSkill(ctx.content, g));
  p['job'] = g.job;
  p['target'] = tree;
  const minutes = Math.ceil((g.def.minutes * 2 * g.def.skilled) / (g.def.skilled + level));
  p['work'] = scaled(ctx, p, g.job, minutes);
  return true;
}
