// Warmth beats work (P3.6, V-046): an awake person whose warmth is under its warning line steps away from
// what they are doing and goes to the nearest reachable tile a lit fire warms enough (the felt
// temperature there reaches the comfort line), and stays, `doing: warm`, until warmth is back to
// the line plus `life.again`. With no lit fire to reach, they light or feed the nearest hearth
// that is out or low themselves (tend.ts), if firewood can be reached. One line when they go. A
// later phase lets temperament and memories shift the line (P4.8).
import type { EntityRow } from '../core/index.ts';
import { furnitureOf, HEARTH } from '../build/index.ts';
import { heatMap } from '../fire/index.ts';
import { loadOf } from '../goods/index.ts';
import { feltAt, needOf } from '../needs/index.ts';
import { canReach, walkAt, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { spotOf } from './spots.ts';
import { coldPick, tendForWarmth } from './tend.ts';
import { walkTo } from './walk.ts';

const LOOK_AGAIN = 30;

/** Whether surface tile `i` is warmed by a fire enough to be comfortable. */
function warmAt(ctx: SystemContext, i: number): boolean {
  const { world, content } = ctx;
  return (
    (heatMap(world, content).get(i) ?? 0) > 0 &&
    feltAt(world, content, i) >= content.life.warmth.comfort
  );
}

/** The nearest warm tile `p` can reach that is not a hearth itself. */
function nearestWarm(ctx: SystemContext, p: EntityRow): Spot | undefined {
  const { world, content } = ctx;
  const width = world.map.width;
  const here = spotOf(p);
  const hearths = new Set(
    furnitureOf(world)
      .filter((f) => f['kind'] === HEARTH && f['z'] === 0)
      .map((f) => (f['y'] as number) * width + (f['x'] as number)),
  );
  const far = (i: number) =>
    Math.max(Math.abs((i % width) - here.x), Math.abs(Math.floor(i / width) - here.y));
  const tiles = [...heatMap(world, content).keys()]
    .filter((i) => !hearths.has(i) && warmAt(ctx, i))
    .sort((a, b) => far(a) - far(b) || a - b);
  for (const i of tiles) {
    const spot = { x: i % width, y: Math.floor(i / width), z: 0 };
    if (walkAt(content, world.map, 0, i) > 0 && canReach(content, world.map, here, spot))
      return spot;
  }
  return undefined;
}

/** Steps away from the work in hand: it stays as it was (the tree, the plan, the load carried),
 * and they take it up again where they left off once they are warm. */
function leaveWork(p: EntityRow): void {
  p['path'] = [];
}

/** One minute of the cold person's choice; true when they are warming up or on the way. */
export function warming(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const life = content.life;
  const def = life.needs.find((n) => n.id === 'warmth');
  const row = needOf(world, p.id, 'warmth');
  if (!def || !row || p['z'] !== 0 || p['job'] === 'tend') return false;
  const value = row['value'] as number;
  const on = p['doing'] === 'warm';
  if (on && value >= def.low + life.again) {
    p['doing'] = '';
    return false;
  }
  if (!on && (value >= def.low || world.tick < (p['chill'] as number))) return false;
  if (on && (p['path'] as number[]).length > 0) return true;
  const i = (p['y'] as number) * world.map.width + (p['x'] as number);
  const go = (): void => {
    if (on) return;
    ctx.emit('people.warming', {
      causes: [row['line'] as number],
      actors: [p.id],
      data: { name: p['name'] as string },
    });
  };
  if (warmAt(ctx, i)) {
    go();
    p['doing'] = 'warm';
    return true;
  }
  const target = nearestWarm(ctx, p);
  if (target) {
    go();
    leaveWork(p);
    if (walkTo(ctx, p, target)) {
      p['doing'] = 'warm';
      return true;
    }
  }
  // Out of a warm place to go, they light or feed a fire themselves, leaving any work for good:
  // with no fire lit anywhere it would only keep them cold (V-046).
  if (!target && p['job'] && coldPick(ctx, p)) Object.assign(p, { job: '', plan: 0, target: -1 });
  // Hands full of something that is not fuel (stone from a building job), tending would stop at
  // once after its line said it began (phase review), so they carry it home first.
  const load = loadOf(world, p.id);
  const full = load && !ctx.content.work.fire.fuels.some((f) => f.item === load['kind']);
  const got = target || p['job'] || full ? undefined : coldPick(ctx, p);
  if (got) {
    go();
    p['doing'] = '';
    if (tendForWarmth(ctx, p, got)) return true;
  }
  p['doing'] = '';
  p['chill'] = world.tick + LOOK_AGAIN;
  return false;
}
