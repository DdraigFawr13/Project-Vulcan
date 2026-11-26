// The road and the valley's name abroad (6B review slice 3, V-214). Songs made in the valley and
// the bynames of the living carry: each adds `draw.fame` percent to the month's chance of a
// stranger, to at most `fame.most`. A valley with no neighbours on record (a test valley made
// straight from a seed word, never picked on the region map) still has a road: once its songs are
// known, someone of the band's own people may come by it from a place `road.days` away, giving the
// songs as their reason. A valley the lord has chartered (V-242) is spoken of too: `fame.charter`
// more, over the cap. Nobody is sent for (V-041).
import type { EngineContent, EntityRow, RngStream, WorldState } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import { placeName, type Neighbour } from '../region/index.ts';

const SIDES = ['north', 'east', 'south', 'west'];

/** The songs made here, the living who carry a byname, and whether the valley is chartered. */
export function fameOf(world: WorldState): { songs: number; bynames: number; charter: boolean } {
  const living = new Set(alive(world).map((p) => p.id));
  const bynames = (world.entities['byname'] ?? []).filter((b) => living.has(b['person'] as number));
  const charter = !!world.entities['lord']?.[0]?.['charter'];
  return { songs: (world.entities['song'] ?? []).length, bynames: bynames.length, charter };
}

/** The percent the valley's name adds to the month's draw. */
export function famePercent(world: WorldState, content: EngineContent): number {
  const f = content.strangers.draw.fame;
  const { songs, bynames, charter } = fameOf(world);
  return Math.min(f.most, songs * f.song + bynames * f.byname) + (charter ? f.charter : 0);
}

/** The words a newcomer gives for the valley's name: its songs, its charter, or both. */
export function fameWords(world: WorldState, content: EngineContent): string {
  const { songs, bynames, charter } = fameOf(world);
  const said = [songs || bynames ? content.strangers.way.words : ''];
  return [...said, charter ? content.strangers.draw.fame.words : ''].filter(Boolean).join(' and ');
}

/** The founders' people: the culture of the first of the founding band in `rows`. */
export function foundersOf(
  content: EngineContent,
  rows: readonly EntityRow[],
): EngineContent['cultures'][number] | undefined {
  const band = rows.find((p) => !p['stranger'] && !p['mother'] && !p['father']);
  return content.cultures.find((c) => c.id === band?.['culture']) ?? content.cultures[0];
}

/** A place down the road, of the founders' people, on a side drawn by seed. */
export function roadOf(world: WorldState, content: EngineContent, rng: RngStream): Neighbour[] {
  const culture = foundersOf(content, alive(world));
  if (!culture) return [];
  const [lo = 1, hi = lo] = content.strangers.way.days;
  const days = lo + rng.int(hi - lo + 1);
  const row = { name: placeName(rng, culture), culture: culture.id, days, dir: rng.pick(SIDES) };
  return [{ ...row, kind: content.strangers.way.kind, reasons: [] }];
}

/** The reason someone from a quiet place gives: the songs, once there are any, else the charter,
 * else wandering. */
export function quietReason(world: WorldState) {
  const { songs, bynames, charter } = fameOf(world);
  return { kind: songs || bynames ? 'song' : charter ? 'charter' : 'wander', line: '' };
}
