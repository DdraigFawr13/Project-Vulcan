// The road and the valley's name abroad (6B review slice 3, V-214). Songs made in the valley and
// the bynames of the living carry: each adds `draw.fame` percent to the month's chance of a
// stranger, to at most `fame.most`. A valley with no neighbours on record (a test valley made
// straight from a seed word, never picked on the region map) still has a road: once its songs are
// known, someone of the band's own people may come by it from a place `road.days` away, giving the
// songs as their reason. Nobody is sent for (V-041).
import type { EngineContent, RngStream, WorldState } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import { placeName, type Neighbour } from '../region/index.ts';

const SIDES = ['north', 'east', 'south', 'west'];

/** The songs made here and the living who carry a byname. */
export function fameOf(world: WorldState): { songs: number; bynames: number } {
  const living = new Set(alive(world).map((p) => p.id));
  const bynames = (world.entities['byname'] ?? []).filter((b) => living.has(b['person'] as number));
  return { songs: (world.entities['song'] ?? []).length, bynames: bynames.length };
}

/** The percent the valley's name adds to the month's draw. */
export function famePercent(world: WorldState, content: EngineContent): number {
  const f = content.strangers.draw.fame;
  const { songs, bynames } = fameOf(world);
  return Math.min(f.most, songs * f.song + bynames * f.byname);
}

/** A place down the road, of the founders' people, on a side drawn by seed. */
export function roadOf(world: WorldState, content: EngineContent, rng: RngStream): Neighbour[] {
  const band = alive(world).find((p) => !p['stranger'] && !p['mother'] && !p['father']);
  const culture = content.cultures.find((c) => c.id === band?.['culture']) ?? content.cultures[0];
  if (!culture) return [];
  const [lo = 1, hi = lo] = content.strangers.way.days;
  const days = lo + rng.int(hi - lo + 1);
  const row = { name: placeName(rng, culture), culture: culture.id, days, dir: rng.pick(SIDES) };
  return [{ ...row, kind: content.strangers.way.kind, reasons: [] }];
}

/** The reason someone from a quiet place gives: the songs, once there are any, else wandering. */
export const quietReason = (fame: number) => ({ kind: fame > 0 ? 'song' : 'wander', line: '' });
