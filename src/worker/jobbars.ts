// Progress bars for the jobs that take worked minutes on a spot (Phase 4 review, Morgan): felling,
// quarrying, foraging, a field tile, mining, sinking a shaft, smelting, burning charcoal, smithing
// and cooking get the same bar as a building (fires.ts `workBars`, drawn by render/progress.ts).
// The engine counts a person's minutes left in `work` and keeps no total, so the worker remembers
// the total it saw when the job was taken up (never saved: a loaded save starts from what is
// left). The bar shows once a minute has been worked, so the walk and the fetching show none.
// Pure reads of the world; nothing here decides a rule (GAME-02).
import { content } from '../content/index.ts';
import {
  furnitureOf,
  piecesOf,
  stationOf,
  shaftsOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { GoodsView } from './protocol.ts';

type Bars = GoodsView['work'];
interface Seen {
  sig: string;
  total: number;
  last: number;
}
const seen = new WeakMap<WorldState, Map<number, Seen>>();

const FIELD_JOBS = ['fell', 'quarry', 'forage', 'farm'];

/** The tile a job's minutes are spent at, or undefined when it cannot be told. */
function spotFor(world: WorldState, p: EntityRow): { x: number; y: number; z: number } | undefined {
  const { width, height } = world.map;
  const job = p['job'] as string;
  const target = p['target'] as number;
  if (FIELD_JOBS.includes(job))
    return target >= 0 ? { x: target % width, y: Math.floor(target / width), z: 0 } : undefined;
  if (job === 'mine') {
    if (p['task'] === 'sink') {
      const s = shaftsOf(world).find((r) => r.id === p['plan']);
      return s && { x: s['x'] as number, y: s['y'] as number, z: p['z'] as number };
    }
    if (target < 0) return undefined;
    const i = target % (width * height);
    return {
      x: i % width,
      y: Math.floor(i / width),
      z: Math.floor(target / (width * height)),
    };
  }
  const at = (r: EntityRow | undefined) =>
    r && { x: r['x'] as number, y: r['y'] as number, z: (r['z'] as number | undefined) ?? 0 };
  if (job === 'smelt') return at(stationOf(world, 'smelter'));
  if (job === 'cure') return at(stationOf(world, 'smokehouse'));
  if (job === 'charcoal') return at(stationOf(world, 'clamp'));
  if (job === 'smith') {
    const forge = content.jobs.find((j) => j.id === 'smith')?.workplace ?? 'forge';
    return at(piecesOf(world, forge)[0]);
  }
  if (job === 'cook') return at(furnitureOf(world).find((f) => f.id === p['plan']));
  return undefined;
}

/** A bar for each person who has worked a minute of a timed job and is at it now. */
export function jobBars(world: WorldState): Bars {
  const memory = seen.get(world) ?? new Map<number, Seen>();
  seen.set(world, memory);
  const bars: Bars = [];
  const live = new Set<number>();
  for (const p of world.entities['person'] ?? []) {
    if (p['status'] !== 'alive') continue;
    const left = p['work'] as number;
    const spot = left > 0 ? spotFor(world, p) : undefined;
    if (!spot) continue;
    live.add(p.id);
    const sig = [p['job'], p['task'], p['plan'], p['target'], p['make'], p['making']].join(':');
    const was = memory.get(p.id);
    // A new job, or minutes left that rose, starts a new total.
    const fresh = !was || was.sig !== sig || left > was.last;
    const total = fresh ? left : Math.max(was.total, left);
    memory.set(p.id, { sig, total, last: left });
    const path = (p['path'] as number[] | undefined)?.length ?? 0;
    if (p['doing'] === 'work' && !path && left < total)
      bars.push({ ...spot, done: total - left, total, by: p.id });
  }
  for (const id of memory.keys()) if (!live.has(id)) memory.delete(id);
  return bars;
}
