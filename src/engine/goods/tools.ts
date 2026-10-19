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

/** The material a worn tool of `material` asks to be replaced by: the next one up that is smithed
 * from an ingot (stone asks for bronze, bronze for iron, iron for none). */
function nextMaterial(content: EngineContent, material: string) {
  const all = content.tools.materials;
  return all.slice(all.findIndex((m) => m.id === material) + 1).find((m) => m.ingot);
}

/** Whether a tool has under `tools.worn` per cent of its life left. */
function isWorn(content: EngineContent, item: EntityRow): boolean {
  const t = toolOf(content, item);
  if (!t) return false;
  const life = lifeFor(content, t.material, item['quality'] as string);
  return (item['wear'] as number) * 100 < life * content.tools.worn;
}

/** The material a tool asks to be replaced by once worn, if it is worn and one can be smithed. */
export function wornAsk(content: EngineContent, item: EntityRow) {
  const t = toolOf(content, item);
  return t && isWorn(content, item) ? nextMaterial(content, t.material) : undefined;
}

const rank = (content: EngineContent, material: string): number =>
  content.tools.materials.findIndex((m) => m.id === material);

/** Held worn tools that ask for a better one (Morgan's card, P4.9): each with the material and
 * ingot it asks for, while no free tool of its kind that good or better lies at the cart. */
export function wornTools(world: WorldState, content: EngineContent): readonly Worn[] {
  // Worked out once a tick and line: what changes the answer (a tool worn, made, taken or
  // broken) writes a line, and the want is read many times a minute.
  const key = `${world.tick}:${world.nextEventId}`;
  const hit = wornCache.get(world);
  if (hit?.key === key && hit.content === content) return hit.out;
  const out: Worn[] = [];
  for (const item of itemsOf(world)) {
    const t = isHeld(item) ? toolOf(content, item) : undefined;
    if (!t || !isWorn(content, item)) continue;
    const next = nextMaterial(content, t.material);
    if (!next?.ingot) continue;
    const free = freeTools(world, content, t.kind);
    if (free.some((f) => rank(content, toolOf(content, f)!.material) >= rank(content, next.id)))
      continue;
    const ingots = content.tools.kinds.find((k) => k.id === t.kind)?.ingots ?? 0;
    out.push({ item, kind: t.kind, material: next.id, ingot: next.ingot, ingots });
  }
  wornCache.set(world, { key, content, out });
  return out;
}

type Worn = { item: EntityRow; kind: string; material: string; ingot: string; ingots: number };
const wornCache = new WeakMap<
  WorldState,
  { key: string; content: EngineContent; out: readonly Worn[] }
>();

/** Ingots of `ingot` the worn tools ask for. */
export const wornIngots = (world: WorldState, content: EngineContent, ingot: string): number =>
  wornTools(world, content)
    .filter((w) => w.ingot === ingot)
    .reduce((n, w) => n + w.ingots, 0);

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
