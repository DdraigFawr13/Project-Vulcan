// Stores as the page shows them (5B Bundle 1): a store tile's name, what it takes and how full it
// is, for the inspector, and which stores keep a Stock plate's good. Pure reads of the world.
import { content } from '../content/index.ts';
import {
  depotsOf,
  depotTiles,
  insideDepot,
  itemsAt,
  storeOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { LedgerLine } from './protocol.ts';

const used = (world: WorldState, tiles: readonly EntityRow[]) =>
  tiles.filter((t) => itemsAt(world, t['x'] as number, t['y'] as number, t['z'] as number).length)
    .length;

const kindOf = (d: EntityRow) => content.buildings.stores.kinds.find((k) => k.id === d['store'])!;

/** What a store lost to spoiling (P5.12): this week so far, and the last three weeks' lines. */
function spoiledOf(world: WorldState, store: number): { spoiled?: string } {
  const now = (world.entities['spoilage'] ?? [])
    .filter((r) => r['store'] === store)
    .reduce((n, r) => n + (r['count'] as number), 0);
  const weeks: number[] = [];
  for (let k = world.log.length - 1; k >= 0 && weeks.length < 3; k -= 1) {
    const e = world.log[k]!;
    if (e.type === 'keep.spoiled' && e.data['store'] === store)
      weeks.push(e.data['count'] as number);
  }
  if (!now && !weeks.length) return {};
  return {
    spoiled: `this week so far ${now}${weeks.length ? ` · weeks before ${weeks.join(', ')}` : ''}`,
  };
}

/** The store a tile belongs to, if any: its name, what it takes, how full, and its lines. */
export function storeTile(
  world: WorldState,
  x: number,
  y: number,
  z: number,
  line: (id: unknown) => LedgerLine | undefined,
):
  | {
      name: string;
      takes: string;
      holds: string;
      spoiled?: string;
      made?: LedgerLine;
      built?: LedgerLine;
    }
  | undefined {
  const home = storeOf(world);
  const tile = home.find((s) => s['x'] === x && s['y'] === y && s['z'] === z);
  if (tile) {
    const made = line(tile['made']);
    return {
      name: 'Home store',
      takes: 'whatever has no store of its own, and what a full store cannot take',
      holds: `${used(world, home)} of ${home.length} tiles`,
      ...spoiledOf(world, 0),
      ...(made && { made }),
    };
  }
  const d = depotsOf(world).find((r) => r['z'] === z && insideDepot(r, x, y));
  if (!d) return undefined;
  const kind = kindOf(d);
  const tiles = depotTiles(d);
  const [made, built] = [line(d['line']), line(d['built'])];
  return {
    name: `${kind.name.charAt(0).toUpperCase()}${kind.name.slice(1)}`,
    takes: kind.words,
    holds:
      d['state'] === 'built'
        ? `${used(world, tiles)} of ${tiles.length} tiles`
        : `planned: ${tiles.length} tiles once its edge stands`,
    ...spoiledOf(world, d.id),
    ...(made && { made }),
    ...(built && { built }),
  };
}

/** "Kept in the wood yard (9 tiles) and the home store (2 tiles)": where a plate's good lies. */
export function keptNote(world: WorldState, good: string): string | undefined {
  const counts = (i: EntityRow) =>
    i['kind'] === good || content.items.find((d) => d.id === i['kind'])?.good === good;
  // Two stores of one kind (two larders) are counted together.
  const tiles = new Map<string, number>();
  const add = (name: string, n: number) => n && tiles.set(name, (tiles.get(name) ?? 0) + n);
  for (const d of depotsOf(world).filter((r) => r['state'] === 'built'))
    add(
      kindOf(d).name,
      depotTiles(d).filter((t) =>
        itemsAt(world, t['x'] as number, t['y'] as number, t['z'] as number).some(counts),
      ).length,
    );
  add(
    'home store',
    storeOf(world).filter((t) =>
      itemsAt(world, t['x'] as number, t['y'] as number, t['z'] as number).some(counts),
    ).length,
  );
  const places = [...tiles].map(([name, n]) => `the ${name} (${n} tile${n > 1 ? 's' : ''})`);
  if (!places.length) return undefined;
  const list =
    places.length < 2 ? places[0]! : `${places.slice(0, -1).join(', ')} and ${places.at(-1)}`;
  return `Kept in ${list}.`;
}
