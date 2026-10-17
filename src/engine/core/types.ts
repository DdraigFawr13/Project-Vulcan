// World state and content shapes. The whole world is plain data (numbers, strings, arrays,
// typed arrays), so it can be posted to the UI, digested for tests and saved later.

import type { RngState } from './rng.ts';

/** Terrain of one tile. Order matters: values are stored in a Uint8Array. */
export const Terrain = { Grass: 0, Water: 1, Rock: 2 } as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];

/** What stands on a tile. Trees and bushes are gathered; the hearth and store are fixed. */
export const Feature = { None: 0, Tree: 1, Bush: 2, Hearth: 3, Store: 4 } as const;
export type Feature = (typeof Feature)[keyof typeof Feature];

export interface TileMap {
  width: number;
  height: number;
  terrain: Uint8Array;
  feature: Uint8Array;
  /** Units left on the tile: berries on a bush, wood in a tree. */
  amount: Uint8Array;
  /** Tick at which a bush next regrows one unit (0 when full or not a bush). */
  regrowAt: Uint32Array;
  /** Colonist id + 1 that has claimed the tile for a job, 0 when free. */
  reservedBy: Uint16Array;
}

export interface Point {
  x: number;
  y: number;
}

/** Needs run from 0 (empty) to NEED_MAX (fully met). */
export interface Needs {
  food: number;
  rest: number;
  company: number;
}

export type NeedId = keyof Needs;

export type Resource = 'food' | 'wood';

/** One step of a colonist's current plan. */
export type Task =
  | { kind: 'idle' }
  | { kind: 'gather'; job: string; phase: 'go' | 'work'; progress: number }
  | { kind: 'eat'; phase: 'go' | 'eat'; progress: number; fromBush: boolean }
  | { kind: 'sleep'; phase: 'go' | 'sleep'; sleptEvent: number }
  | { kind: 'deliver' }
  | { kind: 'stoke'; phase: 'fetch' | 'go' }
  | { kind: 'chat'; partner: number; lead: boolean; progress: number }
  | { kind: 'wander' };

export interface Colonist {
  id: number;
  name: string;
  x: number;
  y: number;
  needs: Needs;
  task: Task;
  /** Remaining path as tile indices, next step first. */
  path: number[];
  carrying: { resource: Resource; amount: number } | null;
  /** Tile index this colonist has reserved (a bush, a tree, a sleeping spot), or -1. */
  claim: number;
  /** Job id this colonist prefers; adds to that job's score. */
  likes: string;
  /** Open "need low" or "need critical" events by need, cited by the event that answers them. */
  openNeedEvents: Partial<Record<NeedId, { id: number; critical: boolean }>>;
}

export interface Colony {
  store: Point;
  hearth: Point;
  stock: Record<Resource, number>;
  /** Hearth fuel in ticks of burning left. */
  hearthFuel: number;
  /** Open colony-level condition events, cited as causes until they close. */
  stockLowEvent: Partial<Record<Resource, number>>;
  hearthOutEvent: number | null;
}

export interface WorldState {
  seed: string;
  tick: number;
  rng: Record<string, RngState>;
  map: TileMap;
  colonists: Colonist[];
  colony: Colony;
  nextEventId: number;
}

/** A logged event. Causes link earlier events so "why did this happen?" has an answer. */
export interface SimEvent {
  id: number;
  tick: number;
  type: string;
  actors: number[];
  place: Point | null;
  causes: number[];
  data: Record<string, string | number>;
}

/** A gather job: walk to a tile feature, work it, carry the yield to the store. */
export interface GatherJobDef {
  id: string;
  label: string;
  feature: Feature;
  resource: Resource;
  workTicks: number;
  /** Below this stock the job has full demand; at twice it, none. */
  stockTarget: number;
  /** Base labour priority (later set by the law book). */
  priority: number;
}

export interface EventTypeDef {
  /** 1 routine, 2 notable, 3 major. */
  importance: 1 | 2 | 3;
  /** Text with {actor0}, {actor1} and {data key} slots. */
  template: string;
}

export interface Tuning {
  ticksPerDay: number;
  ticksPerHour: number;
  needMax: number;
  decayPerTick: Needs;
  /** A need below this starts a "need low" event and drives behaviour. */
  lowAt: Needs;
  /** A need below this is critical (collapse, starving). */
  criticalAt: Needs;
  mealValue: number;
  eatTicks: number;
  restPerTickWarm: number;
  restPerTickCold: number;
  /** Rest level at which a sleeper wakes. */
  wakeAt: number;
  nightStartHour: number;
  nightEndHour: number;
  chatTicks: number;
  chatValue: number;
  /** Tiles within which two colonists can start a chat. */
  chatRange: number;
  /** Ticks of burning one wood gives the hearth. */
  fuelPerWood: number;
  /** Hearth fuel below this sends someone to stoke it. */
  stokeBelow: number;
  /** Tiles from the hearth that count as warm for sleeping. */
  warmRadius: number;
  bushMax: number;
  bushRegrowTicks: number;
  treeWood: number;
  likedJobBonus: number;
  startingStock: Record<Resource, number>;
}

export interface MapGenDef {
  width: number;
  height: number;
  /** Coarse noise cell size in tiles. */
  noiseCell: number;
  /** Height thresholds as fractions of 1000. */
  waterBelow: number;
  rockAbove: number;
  /** Moisture above which trees grow, as a fraction of 1000. */
  forestAbove: number;
  treeChance: number;
  bushChance: number;
  clearRadius: number;
}

export interface Content {
  tuning: Tuning;
  /** Words for a need running low and running out, used in need events. */
  needWords: Readonly<Record<NeedId, { low: string; critical: string }>>;
  /** Words for resources in event text. */
  resourceWords: Readonly<Record<Resource, string>>;
  map: MapGenDef;
  colonistCount: number;
  names: readonly string[];
  jobs: readonly GatherJobDef[];
  events: Readonly<Record<string, EventTypeDef>>;
}
