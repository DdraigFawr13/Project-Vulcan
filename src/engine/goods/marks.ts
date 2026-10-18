// Test mode levers (P2.4, `?debug` only): the direct tools kept for trying things out, never
// shown in the ordinary game (V-015). `markFell` marks a tree, which the next free person able
// to fell takes up before any other; `markStore` adds an open tile to the store by hand. Each is
// an order with its own `command.applied` line, so what follows still has a cause.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { freeTile } from './store.ts';

export const MARK_TABLES: Schemas = {
  /** A surface tree marked to fell in test mode, and the order that marked it. */
  mark: { x: 'int', y: 'int', line: 'event' },
};

export const marksOf = (world: WorldState): EntityRow[] => world.entities['mark'] ?? [];

/** Whether surface tile `i` holds a tree or a fallen log. */
export function isTree(world: WorldState, content: EngineContent, i: number): boolean {
  const f = world.map.features[i]!;
  const kind = f ? content.features[f - 1]?.kind : undefined;
  return kind === 'tree' || kind === 'log';
}

/** Clears the mark on a tile once its tree is down. */
export function unmark(world: WorldState, x: number, y: number): void {
  const mark = marksOf(world).find((m) => m['x'] === x && m['y'] === y);
  if (mark) removeEntity(world, 'mark', mark.id);
}

const at = (ctx: SystemContext, data: Readonly<Record<string, unknown>>) => {
  const { x, y } = data;
  const map = ctx.world.map;
  if (typeof x !== 'number' || typeof y !== 'number') return undefined;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return { x, y };
};

const refuse = (ctx: SystemContext, kind: string, reason: string, cause: number) =>
  void ctx.emit('command.refused', { causes: [cause], data: { kind, reason } });

export const markCommands = {
  markFell(ctx: SystemContext, data: Readonly<Record<string, unknown>>, cause: number): void {
    const tile = at(ctx, data);
    const i = tile ? tile.y * ctx.world.map.width + tile.x : -1;
    if (!tile || !isTree(ctx.world, ctx.content, i))
      return refuse(ctx, 'markFell', 'no tree there', cause);
    if (marksOf(ctx.world).some((m) => m['x'] === tile.x && m['y'] === tile.y)) return;
    addEntity(ctx.world, 'mark', { ...tile, line: cause });
  },
  markStore(ctx: SystemContext, data: Readonly<Record<string, unknown>>, cause: number): void {
    const tile = at(ctx, data);
    if (!tile || !freeTile(ctx.world, ctx.content, tile.x, tile.y))
      return refuse(ctx, 'markStore', 'not open ground the camp can reach', cause);
    const made = ctx.emit('goods.storeMarked', { causes: [cause], data: tile });
    addEntity(ctx.world, 'store', { ...tile, z: 0, made });
  },
};

/** The nearest marked tree not in `taken` that `goTo` can set them off beside (it does), with
 * the order that marked it. */
export function markedTree(
  world: WorldState,
  content: EngineContent,
  taken: ReadonlySet<number>,
  here: Spot,
  goTo: (x: number, y: number) => boolean,
): { tree: number; line: number } | undefined {
  const width = world.map.width;
  const far = (m: EntityRow) =>
    Math.max(Math.abs((m['x'] as number) - here.x), Math.abs((m['y'] as number) - here.y));
  const marks = marksOf(world)
    .map((m) => ({ m, i: (m['y'] as number) * width + (m['x'] as number) }))
    .filter(({ i }) => isTree(world, content, i) && !taken.has(i))
    .sort((a, b) => far(a.m) - far(b.m) || a.m.id - b.m.id);
  for (const { m, i } of marks)
    if (goTo(m['x'] as number, m['y'] as number)) return { tree: i, line: m['line'] as number };
  return undefined;
}
