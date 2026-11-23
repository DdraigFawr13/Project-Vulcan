// The tavern's tables and their reads (6B Bundle 5, P6.12, V-188): the tavern itself (its house,
// name and keeper), each cask's brew, and each person's evening there.
import { today, type EntityRow, type WorldState } from '../core/index.ts';
import { furnitureOf, houseAt, INN_TAVERN, tavernHouse } from '../build/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';

export const INN_TABLES: Schemas = {
  /** The tavern once built: its house row, its name and the line that named it; the innkeeper (0
   * for none) and the line that made them so; the line saying grain is kept for eating, while it is. */
  tavern: {
    ...{ house: 'entity', name: 'text', line: 'event', keeper: 'entity', kept: 'event' },
    noGrain: 'event',
  },
  /** A cask's brew: the furniture piece, what is in it (`ale`, `mead`), cups left, the tick it is
   * ready and the line that brewed it. */
  keg: { piece: 'entity', drink: 'text', cups: 'count', ready: 'int', line: 'event' },
  /** A person's evening (one row each, renewed every evening): the game day it is for, 1 if they
   * go, the tick they came (0 not yet), 1 while walking there, cups drunk, the tick they leave
   * (0: stay), 1 once the brawl's dice were thrown, the tick a hangover lasts to, the last cup's line. */
  night: {
    ...{ person: 'entity', day: 'int', go: 'count', came: 'int', going: 'count', cups: 'count' },
    ...{ leave: 'int', brawled: 'count', hung: 'int', line: 'event' },
  },
};

/** The tavern's row, once it stands and is named. */
export const tavernOf = (world: WorldState): EntityRow | undefined => {
  const h = tavernHouse(world);
  return h && (world.entities['tavern'] ?? []).find((t) => t['house'] === h.id);
};

/** The tavern's name, "the tavern" before it has one. */
export const tavernName = (world: WorldState): string =>
  (tavernOf(world)?.['name'] as string | undefined) ?? 'the tavern';

/** Whether `p` stands inside the built tavern. */
export function inTavern(world: WorldState, p: EntityRow): boolean {
  if (p['z'] !== 0) return false;
  const h = houseAt(world, p['x'] as number, p['y'] as number);
  return !!h && h['inn'] === INN_TAVERN && h['state'] === 'built';
}

/** Brews in casks that still stand (a keg row outlives a cask taken down, unread). */
export function kegsOf(world: WorldState): EntityRow[] {
  const standing = new Set(
    furnitureOf(world)
      .filter((f) => f['state'] === 'built')
      .map((f) => f.id),
  );
  return (world.entities['keg'] ?? []).filter((k) => standing.has(k['piece'] as number));
}

/** Cups in the tavern's casks, ready or still brewing. */
export const cupsHeld = (world: WorldState): number =>
  kegsOf(world).reduce((n, k) => n + (k['cups'] as number), 0);

/** A ready cask with cups in it, the fullest first. */
export const readyKeg = (world: WorldState): EntityRow | undefined =>
  kegsOf(world)
    .filter((k) => (k['cups'] as number) > 0 && (k['ready'] as number) <= world.tick)
    .sort((a, b) => (b['cups'] as number) - (a['cups'] as number) || a.id - b.id)[0];

/** A person's evening row, if they have had one. */
export const nightOf = (world: WorldState, person: number): EntityRow | undefined =>
  (world.entities['night'] ?? []).find((n) => n['person'] === person);

/** Cups `p` has drunk this evening. */
export function cupsTonight(world: WorldState, person: number): number {
  const n = nightOf(world, person);
  return n && n['day'] === today(world) ? (n['cups'] as number) : 0;
}

/** The innkeeper's id, 0 for none. */
export const keeperOf = (world: WorldState): number =>
  (tavernOf(world)?.['keeper'] as number | undefined) ?? 0;

/** A cask filled: its brew row, new or refilled. */
export function fillCask(
  world: WorldState,
  piece: number,
  fill: { drink: string; cups: number; ready: number; line: number },
): void {
  const keg = (world.entities['keg'] ?? []).find((k) => k['piece'] === piece);
  if (keg) Object.assign(keg, fill);
  else addEntity(world, 'keg', { piece, ...fill });
}
