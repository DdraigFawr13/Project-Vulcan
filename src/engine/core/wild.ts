// What the wild valley reads from content (wild.json, Phase 5 Bundle 2) and the creatures file.

/** A good left where an animal falls, or by a predator's kill. */
export interface LeftoverDef {
  item: string;
  count: number;
}

/** One kind of game: how many herds the valley holds, how it lives and what it leaves. */
export interface SpeciesDef {
  id: string;
  name: string;
  plural: string;
  /** Art kinds in a repeating pattern over a herd's animals (`hind` `hind` `stag`). */
  kinds: readonly string[];
  /** The print id (`wild.prints`) its feet leave. */
  print: string;
  /** Game laid where it falls, and the leftovers. */
  meat: number;
  leftovers: readonly LeftoverDef[];
  /** Tiles at which a person sets the herd running. */
  flee: number;
  perGame: number;
  size: readonly number[];
  /** Habitat: a biome, its weight (per hundred) towards the herd count, and for an edge biome
   * the tiles from a tree it may be placed within. */
  habitat: readonly { biome: string; weight: number; edge?: number }[];
  /** Terrain ids the herd stands on at placement (all open ground when left out). */
  ground?: readonly string[];
  /** With `ground`: a herd may stand on that ground within this many tiles of its biomes. */
  foot?: number;
  /** Weighted habitat tiles to a herd; herds = round(weighted tiles / perHerd). */
  perHerd: number;
  cap: number;
  breed: { months: readonly string[]; rate: number };
}

/** A predator: the creature whose biomes and names it takes, and what its carcass leaves. */
export interface PredatorDef {
  kind: string;
  name: string;
  creature: string;
  size: readonly number[];
  print: string;
  meat: number;
  leftovers: readonly LeftoverDef[];
}

export interface WildDef {
  species: readonly SpeciesDef[];
  predators: readonly PredatorDef[];
  prints: readonly { id: string; name: string }[];
  /** Grounds that take a print on a wet day. */
  soft: readonly string[];
  printHours: number;
  /** Hours between redraws of the chunks that took or lost prints (each redraw resends them). */
  printRedraw: number;
  /** Hunters leave each herd its last `spare`. */
  spare: number;
  place: { start: number; apart: number; radius: number; tries: number; spread: number };
  /** Minutes between steps; flight steps every `fleeEvery` and lasts `fleeFor` minutes. */
  move: {
    every: number;
    fleeEvery: number;
    trot: number;
    fleeFor: number;
    wander: number;
    reach: number;
  };
  winter: readonly string[];
  /** Herd sizes at which the line `wild.herdLow` is written: below this share (x/100) of the start. */
  low: number;
  /** A winter day's loss per animal, scaled by herd size over the species cap. */
  snowLoss: number;
  pack: {
    den: { from: number; radius: number; far: number };
    near: string;
    roam: number;
    offMap: number;
    offMapWinter: number;
    harsh: string;
    harshFactor: number;
    inValley: number;
    gameFull: number;
    snowFactor: number;
    snowMost: number;
    hungry: number;
    hungryEvery: number;
    visit: number;
    visitEvery: number;
    night: { from: number; to: number };
    least: number;
    returns: { month: string; chance: number };
    why: { harsh: string; winter: string; other: string };
    left: { dead: string; few: string };
    where: { edge: string; midden: string; flock: string };
  };
  where: Readonly<Record<string, string>>;
  /** The people's side (flee, fight, attack, tracks): distances are tiles, chances per cent. */
  folk: {
    sight: { day: number; night: number };
    night: { from: number; to: number };
    bold: readonly string[];
    timid: readonly string[];
    armed: readonly string[];
    together: number;
    den: number;
    beside: number;
    alone: number;
    attackAfter: number;
    prowl: number;
    witness: number;
    rounds: number;
    strike: { base: number; perLevel: number; most: number };
    bite: {
      chance: number;
      parts: readonly { id: string; weight: number }[];
      severities: readonly { id: string; weight: number }[];
    };
    hits: number;
    limp: number;
    tracks: { hours: number; ring: number; packDays: number };
    memories: { tracks: string; stood: string; attack: string };
    compass: readonly string[];
    when: readonly { from: number; to: number; word: string }[];
    words: {
      came: string;
      seen: string;
      stood: string;
      ran: string;
      ranAway: string;
      last: string;
      alone: string;
      struck: string;
      slew: string;
      bitten: string;
      bitePart: string;
      unhurt: string;
    };
  };
}

/** The part of a creature entry the pack reads. */
export interface CreatureDef {
  id: string;
  biomes: readonly string[];
  names: readonly string[];
}

export interface WildDefs {
  wild: WildDef;
  creatures: readonly CreatureDef[];
}
