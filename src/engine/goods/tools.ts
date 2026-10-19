// Tools as items (Bundle 3, V-088): a tool is an item whose items.json entry has `tool: {kind,
// material}`. Its speed is the material's plus the quality word's bonus (tools.json), its life the
// material's work minutes, ten per cent a quality step from plain more or less. Free tools lie in
// the store; a tool someone has taken is theirs (`owner`, `state` `held`) and lies on no tile.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { itemsOf, layItem } from './stacks.ts';

/** Where a tool someone holds "lies": on no tile of the map. */
export const HELD = { x: -1, y: -1, z: 0 } as const;

/** Where free tools are kept: with the handcart, not on the store's tiles (a store tile holds one
 * stack of one kind, and each tool is its own). */
export function restOf(world: WorldState, content: EngineContent) {
  const cart = itemsOf(world).find((i) => i['kind'] === content.life.cart.kind);
  return cart
    ? { x: cart['x'] as number, y: cart['y'] as number, z: cart['z'] as number }
    : { x: world.map.startX, y: world.map.startY, z: 0 };
}

/** The kind and material of a tool item, if it is one. */
export const toolOf = (content: EngineContent, item: EntityRow) =>
  content.items.find((i) => i.id === item['kind'])?.tool;

/** Whether the item is a tool someone holds. */
export const isHeld = (item: EntityRow): boolean => item['state'] === 'held';

/** The items.json id of a tool of this kind and material. */
export const toolItemId = (content: EngineContent, kind: string, material: string) =>
  content.items.find((i) => i.tool?.kind === kind && i.tool.material === material)?.id;

/** Steps from plain: fine is +1, poor -1, by the order of the furniture quality words. */
export function qualityStep(content: EngineContent, word: string): number {
  const words = content.buildings.furniture.quality.map((q) => q.id);
  return words.indexOf('plain') - words.indexOf(word);
}

/** Work minutes a new tool of this material and quality has in it. */
export function lifeFor(content: EngineContent, material: string, word: string): number {
  const life = content.tools.materials.find((m) => m.id === material)?.life ?? 0;
  return Math.max(
    1,
    Math.floor((life * (100 + content.tools.step * qualityStep(content, word))) / 100),
  );
}

/** A tool's speed in per cent: its material's plus its quality word's bonus. */
export function speedOf(content: EngineContent, item: EntityRow): number {
  const t = toolOf(content, item);
  const base = content.tools.materials.find((m) => m.id === t?.material)?.speed ?? 0;
  return base + (content.tools.quality[item['quality'] as string] ?? 0);
}

/** The tools of a kind lying free (not held), best first, ties by id. */
export function freeTools(world: WorldState, content: EngineContent, kind: string): EntityRow[] {
  return itemsOf(world)
    .filter((i) => toolOf(content, i)?.kind === kind && !isHeld(i) && !i['holder'])
    .sort((a, b) => speedOf(content, b) - speedOf(content, a) || a.id - b.id);
}

/** The tools `person` holds. */
export const heldBy = (world: WorldState, content: EngineContent, person: number): EntityRow[] =>
  itemsOf(world).filter((i) => isHeld(i) && i['owner'] === person && toolOf(content, i));

/** Lays a new tool on a spot (the store); returns the item. */
export function layTool(
  world: WorldState,
  content: EngineContent,
  at: { x: number; y: number; z: number },
  tool: { kind: string; material: string; quality: string; made: number; trail?: string },
): EntityRow {
  const kind = toolItemId(content, tool.kind, tool.material)!;
  const id = layItem(
    world,
    { kind, count: 1, ...at, made: tool.made },
    {
      quality: tool.quality,
      wear: lifeFor(content, tool.material, tool.quality),
      ...(tool.trail && { trail: tool.trail }),
    },
  );
  return itemsOf(world).find((i) => i.id === id)!;
}
