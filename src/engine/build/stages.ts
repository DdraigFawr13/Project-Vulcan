// Houses grow in stages (6B Bundle 3 part 2, P6.9, V-052, V-097): each stage starts from need,
// never a timer, with a line saying why, and says once what it waits on. A house whose hearths
// burned `stages.stone.burned` firewood in one winter through timber or daub walls wants its walls
// in dressed stone, set in lime where lime can be had, else clay; worn thatch wants slate where
// slate can be had; daub walls want limewash once lime can be had. The mason does the work
// (crafts/mason.ts), from lime the lime burner makes (crafts/lime.ts). `buildings.masonry`.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { clockAt, TICKS_PER_DAY } from '../core/index.ts';
import { haveOf } from '../goods/index.ts';
import { isKnown } from '../map/index.ts';
import { besideReachable, canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { houseAt, mainOf, rowsOf } from './beds.ts';
import { partOf, plansOf } from './plans.ts';
import { greenOf } from './ring.ts';
import { roofName, wornThatch } from './roofs.ts';
import { housesOf, rectOf } from './site.ts';

const masonry = (content: EngineContent) => content.buildings.masonry;

/** The boulders by each rock, worked out once a day per world (rock does not move; a boulder
 * broken since is dropped by `bouldersBy`). */
const found = new WeakMap<WorldState, { day: number; by: Map<string, number[]> }>();

/** Surface boulder tiles within the masonry reach of the green, standable beside from it, that
 * lie within `near` of a `rock` tile, nearest the green first, ties in tile order. */
export function bouldersBy(
  world: WorldState,
  content: EngineContent,
  rock: string,
  near: number,
): number[] {
  const day = Math.floor(world.tick / 1440);
  let memo = found.get(world);
  if (!memo || memo.day !== day) found.set(world, (memo = { day, by: new Map() }));
  const key = `${rock}:${near}`;
  const list = memo.by.get(key) ?? scanBoulders(world, content, rock, near);
  memo.by.set(key, list);
  const { features } = world.map;
  // Only boulders on known ground (V-205), asked now: the day's list is of every boulder.
  return list.filter(
    (i) => content.features[(features[i] ?? 0) - 1]?.kind === 'boulder' && isKnown(world.map, i),
  );
}

function scanBoulders(
  world: WorldState,
  content: EngineContent,
  rock: string,
  near: number,
): number[] {
  const { width, height, tiles, features } = world.map;
  const kind = content.terrain.kinds.findIndex((k) => k.id === rock);
  const g = greenOf(world);
  const r = masonry(content).reach;
  const out: { i: number; d: number }[] = [];
  for (let y = Math.max(0, g.y - r); y <= Math.min(height - 1, g.y + r); y += 1)
    for (let x = Math.max(0, g.x - r); x <= Math.min(width - 1, g.x + r); x += 1) {
      const f = features[y * width + x]!;
      if (!f || content.features[f - 1]?.kind !== 'boulder') continue;
      let by = false;
      for (let dy = -near; dy <= near && !by; dy += 1)
        for (let dx = -near; dx <= near && !by; dx += 1) {
          const [nx, ny] = [x + dx, y + dy];
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) by = tiles[ny * width + nx] === kind;
        }
      const i = y * width + x;
      if (by && besideReachable(world, content, (to) => canReach(content, world.map, g, to), i))
        out.push({ i, d: Math.max(Math.abs(x - g.x), Math.abs(y - g.y)) });
    }
  return out.sort((a, b) => a.d - b.d || a.i - b.i).map((o) => o.i);
}

/** Whether slate lies in the colony or a boulder by slate rock can be split for it. */
export function slateCanBeHad(world: WorldState, content: EngineContent): boolean {
  const s = masonry(content).mason.split;
  return (
    haveOf(world, content, 'slate') > 0 || bouldersBy(world, content, s.rock, s.near).length > 0
  );
}

/** Whether lime lies in the colony, or limestone does or can be broken for it. */
export function limeCanBeHad(world: WorldState, content: EngineContent): boolean {
  const l = masonry(content).lime;
  return (
    haveOf(world, content, 'lime') > 0 ||
    haveOf(world, content, 'limestone') >= l.burn.limestone ||
    bouldersBy(world, content, l.rock, l.near).length > 0
  );
}

/** The wall part a house row's stone stage sets, by its `mortar`. */
export function stoneWallOf(content: EngineContent, h: EntityRow): string {
  const st = masonry(content).stages.stone;
  return h['mortar'] === 'lime' ? st.lime : h['mortar'] === 'dry' ? st.dry : st.clay;
}

/** Slate a house row's roof takes. */
export const slateFor = (content: EngineContent, h: EntityRow): number => {
  const r = rectOf(h);
  return Math.ceil((r.w * r.h) / masonry(content).mason.slate.per);
};

/** The built wall plan rows of a house (its rooms too) whose part is one of `parts`. */
export function wallsOf(world: WorldState, main: EntityRow, parts: readonly string[]): EntityRow[] {
  const ids = new Set(rowsOf(world, main).map((h) => h.id));
  return plansOf(world).filter(
    (p) =>
      ids.has(p['house'] as number) &&
      p['state'] === 'built' &&
      parts.includes(p['part'] as string),
  );
}

/** The winter a tick falls in, as a year count, or -1 outside winter. */
function winterOf(world: WorldState, content: EngineContent): number {
  const c = clockAt(world.tick, content.calendar);
  return content.calendar.seasons[c.season] === 'winter' ? c.year : -1;
}

/** Counts `n` firewood laid on hearth piece `piece`'s fire against its house this winter. */
export function noteBurn(
  world: WorldState,
  content: EngineContent,
  piece: EntityRow,
  n: number,
): void {
  const year = winterOf(world, content);
  const at = houseAt(world, piece['x'] as number, piece['y'] as number);
  if (year < 0 || !at) return;
  const h = mainOf(world, at);
  if (h['burnYear'] !== year) Object.assign(h, { burnYear: year, burned: 0 });
  h['burned'] = (h['burned'] as number) + n;
}

/** Starts a stage on house row `h` with its line. */
function want(ctx: SystemContext, h: EntityRow, stage: string, why: string, what: string): void {
  const line = ctx.emit('build.stageWanted', {
    causes: [(h['roofLine'] as number) || (h['built'] as number)].filter((l) => l > 0),
    data: { size: roofName(ctx.world, ctx.content, h), why, what },
  });
  Object.assign(h, { stage, stageLine: line, stageWait: 0 });
}

/** The stage a built house row could start now, if any. */
function startStage(ctx: SystemContext, h: EntityRow): void {
  const { world, content } = ctx;
  const def = masonry(content).stages;
  if (wornThatch(world, content, h) && slateCanBeHad(world, content))
    return want(
      ctx,
      h,
      'slate',
      'has worn thatch and slate can be split nearby',
      'it roofed in slate',
    );
  if (h['of']) return;
  const wall = partOf(content, h['wall'] as string);
  const burned = h['burned'] as number;
  if (burned >= def.stone.burned && wallsOf(world, h, def.stone.from).length) {
    h['mortar'] = limeCanBeHad(world, content) ? 'lime' : 'clay';
    const walls = wall?.name.replace(/ wall$/, '') ?? 'timber';
    return want(
      ctx,
      h,
      'stone',
      `burned ${burned} firewood this winter through its ${walls} walls`,
      'it rebuilt in stone',
    );
  }
  if (wallsOf(world, h, [def.wash.from]).length && limeCanBeHad(world, content))
    want(ctx, h, 'wash', 'has clay walls and lime can be had', 'them limewashed');
}

/** Hourly: built houses start the stages they need. */
export function startStages(ctx: SystemContext): void {
  for (const h of housesOf(ctx.world))
    if (h['state'] === 'built' && !h['stage']) startStage(ctx, h);
}

/** Says once that house row `h`'s stage waits, and on what. */
export function sayStageWaits(ctx: SystemContext, h: EntityRow, lack: string): void {
  if (h['stageWait']) return;
  const name = masonry(ctx.content).stages[h['stage'] as 'stone' | 'slate' | 'wash']?.name ?? '';
  h['waitedAt'] = ctx.world.tick;
  h['stageWait'] = ctx.emit('build.stageWaits', {
    causes: [h['stageLine'] as number].filter((l) => l > 0),
    data: { size: roofName(ctx.world, ctx.content, h), stage: name, lack },
  });
}

/** A stone stage that has waited `stone.dryAfter` days for clay is laid dry instead, with a line
 * (6B balance: on the 250-tile valley ledger-1's miner never met clay and it waited ten years).
 * True when it turned. */
export function layDry(ctx: SystemContext, h: EntityRow): boolean {
  const st = masonry(ctx.content).stages.stone;
  const days = Math.floor((ctx.world.tick - (h['waitedAt'] as number)) / TICKS_PER_DAY);
  if (h['mortar'] !== 'clay' || !h['stageWait'] || days < st.dryAfter) return false;
  h['mortar'] = 'dry';
  ctx.emit('build.laidDry', {
    causes: [h['stageWait'] as number],
    data: { size: roofName(ctx.world, ctx.content, h), days },
  });
  return true;
}

/** House rows whose stage is `stage`, in id order. */
export const housesAt = (world: WorldState, stage: string): EntityRow[] =>
  housesOf(world).filter((h) => h['state'] === 'built' && h['stage'] === stage);

/** Lime the stages want beyond what the colony has: a lime each for stone walls still to set in
 * lime mortar, and a lime a `wash.per` of the clay walls to wash. */
export function limeWanted(world: WorldState, content: EngineContent): number {
  const { stone, wash } = masonry(content).stages;
  let n = 0;
  for (const h of housesAt(world, 'stone'))
    if (h['mortar'] === 'lime') n += wallsOf(world, h, stone.from).length;
  for (const h of housesAt(world, 'wash'))
    n += Math.ceil(wallsOf(world, h, [wash.from]).length / wash.per);
  return n > 0 ? n - haveOf(world, content, 'lime') : 0;
}

/** Clay the stone walls still to set in clay mortar take (the miner digs it, land/clay.ts). */
export function clayMortarWanted(world: WorldState, content: EngineContent): number {
  const st = masonry(content).stages.stone;
  const per = partOf(content, st.clay)?.also?.cost ?? 0;
  let n = 0;
  for (const h of housesAt(world, 'stone'))
    if (h['mortar'] === 'clay') n += wallsOf(world, h, st.from).length * per;
  return n;
}
