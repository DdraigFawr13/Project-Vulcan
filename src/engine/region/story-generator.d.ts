// The part of the Story Generator package (DECISIONS V-031) that the region reads. tsconfig `paths`
// points both of its imports (engine and content) here, so Vulcan's checks type the seam and not the package's own source,
// which the Story Generator's CI checks; Vite and Vitest load the real files.
export interface SimEvent {
  id: number;
  day: number;
  type: string;
  importance: number;
  actors: number[];
  place: number | null;
  causes: number[];
  data: Record<string, string | number | boolean>;
}
export interface PopBand {
  raceId: string;
  cultureId: string;
  count: number;
}
export interface Site {
  id: number;
  name: string;
  kind: string;
  cell: number;
  civId: number | null;
  founded: number;
  ruinedYear?: number;
  pop: PopBand[];
  faithId?: number;
}
export interface Region {
  id: number;
  kind: string;
  name: string;
  /** Ascending cell indices. */
  cells: number[];
  anchor: number;
}
export interface WorldCells {
  width: number;
  height: number;
  elevation: Int16Array;
  tempSummer: Int8Array;
  tempWinter: Int8Array;
  rainfall: Uint16Array;
  /** Downstream neighbour as a D8 index, -1 at the sea or none. */
  flowDir: Int8Array;
  flow: Uint32Array;
  /** 0 land, 1 river, 2 lake, 3 sea. */
  water: Uint8Array;
  /** Index into the biome list, which Vulcan's biomes.json keeps in the same order. */
  biome: Uint8Array;
}
export interface WorldState {
  seed: string;
  cells: WorldCells | null;
  regions: Map<number, Region>;
  civs: Map<number, { id: number; name: string; cultureId: string; fell?: number }>;
  sites: Map<number, Site>;
  faiths: Map<number, { name: string }>;
  people: Map<number, { name: string }>;
  events: SimEvent[];
}
export interface WorldParams {
  width: number;
  height: number;
  historyYears: number;
}
export declare const D8_DX: readonly number[];
export declare const D8_DY: readonly number[];
export declare function generateWorld(
  seed: string,
  params: Partial<WorldParams>,
  content: unknown,
): WorldState;
export declare function validateContent(content: unknown): string[];
export declare function templateNarrator(
  content: unknown,
  nameOf: (id: number) => string,
  personOf?: (id: number) => unknown,
): { renderEvent(event: SimEvent): string };

/** The Story Generator's own content: every table its world and history read. */
export declare const DEFAULT_CONTENT: Record<string, unknown>;
