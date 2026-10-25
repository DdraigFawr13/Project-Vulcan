// The flock and its pasture as the Build sheet, the Stock sheet and the map show them (Phase 5
// Bundle 3): the Pasture row, the flock plate, the meadow and rick frames. Pure reads of the world
// and content; every word is made here (GAME-02). Nothing names an animal or a tile as a target
// (V-041): the Pasture row and the Herding row are the only levers.
import { content } from '../content/index.ts';
import {
  dirFrom,
  flockOf,
  flocksOf,
  greenOf,
  headOf,
  herdOf,
  herdsOf,
  hurdleTiles,
  keptOf,
  livePastures,
  meadowTiles,
  pasturesOf,
  plansOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { GoodsView } from './protocol-goods.ts';
import type { FlockPlate, PastureRow } from './protocol-flock.ts';

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export const num = (n: number): string => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const { flock: def } = content;
const nameWords = (s: string): string => s.replace(/^(wild|mountain) /, '');

/** The kind words of a flock, "1 ram, 4 ewes, 2 lambs", for one species of its animals. */
function breakdown(animals: readonly EntityRow[], species: string): string {
  const kd = def.kinds.find((k) => k.species === species)!;
  return [
    [kd.male, kd.maleName],
    [kd.female, kd.femaleName],
    [kd.young, kd.youngName],
  ]
    .flatMap(([kind, word]) => {
      const n = animals.filter((a) => a['kind'] === kind).length;
      return n ? [`${n} ${n === 1 ? word : `${word}s`}`] : [];
    })
    .join(', ');
}

/** The species a kept animal is. */
export const speciesOf = (world: WorldState, a: EntityRow): string =>
  herdOf(world, a['herd'] as number)!['species'] as string;

/** "sheep" or "goats" for `n` of a species, from the wild species' words. */
export function speciesWord(species: string, n: number): string {
  const sp = content.wild.species.find((s) => s.id === species)!;
  return nameWords(n === 1 ? sp.name : sp.plural);
}

/** The head of a flock by species: its count and kind words, "1 ram, 4 ewes, 2 lambs". */
export function headParts(
  world: WorldState,
  flock: EntityRow,
): { species: string; n: number; text: string }[] {
  const all = keptOf(world, flock);
  return def.kinds.flatMap((k) => {
    const mine = all.filter((a) => speciesOf(world, a) === k.species);
    return mine.length
      ? [{ species: k.species, n: mine.length, text: breakdown(mine, k.species) }]
      : [];
  });
}

/** The hay the rick holds and the days it feeds the head: "830 in the rick, enough for 7 for 118 days". */
export function hayWords(world: WorldState, flock: EntityRow): string {
  const [hay, head] = [flock['hay'] as number, headOf(world, flock)];
  if (!hay)
    return `none yet; the herders want ${num(def.pasture.holds * def.hay.plan)} for ${def.pasture.holds} head through the winter`;
  return head
    ? `${num(hay)} in the rick, enough for ${head} for ${plural(Math.floor(hay / head), 'day')}`
    : `${num(hay)} in the rick, and no flock to eat it`;
}

/** The nearest wild herd of a tameable species, for the need line: where wild sheep graze. */
function wildNeed(world: WorldState): string | undefined {
  const green = greenOf(world);
  const herds = herdsOf(world).filter(
    (h) => !h['kept'] && def.tame.species.includes(h['species'] as string),
  );
  const near = [...herds].sort(
    (a, b) =>
      Math.abs((a['x'] as number) - green.x) +
      Math.abs((a['y'] as number) - green.y) -
      (Math.abs((b['x'] as number) - green.x) + Math.abs((b['y'] as number) - green.y)),
  )[0];
  if (!near) return undefined;
  const names = [...new Set(herds.map((h) => h['species'] as string))].map(
    (id) => content.wild.species.find((sp) => sp.id === id)!.plural,
  );
  const dir = dirFrom(green, { x: near['x'] as number, y: near['y'] as number, w: 1, h: 1 });
  return `${cap(names.join(' and '))} graze ${dir} of the green`;
}

/** Built hurdle tiles (plans with state `built`) of a pasture, and all of them. */
function hurdles(world: WorldState, p: EntityRow): [number, number] {
  const built = new Set(
    plansOf(world)
      .filter((q) => q['state'] === 'built' && q['z'] === 0)
      .map((q) => (q['y'] as number) * world.map.width + (q['x'] as number)),
  );
  const all = hurdleTiles(content, world.map.width, p);
  return [all.filter((t) => built.has(t.i)).length, all.length];
}

const COMPASS: Record<string, string> = {
  nw: 'north-west',
  ne: 'north-east',
  sw: 'south-west',
  se: 'south-east',
};
export const cornerWord = (p: EntityRow): string => COMPASS[p['corner'] as string] ?? '';

/** Where a pasture lies from the green, "south-east". */
export const whereOf = (world: WorldState, p: EntityRow): string =>
  dirFrom(greenOf(world), {
    x: p['x'] as number,
    y: p['y'] as number,
    w: p['w'] as number,
    h: p['h'] as number,
  });

/** The Pasture level (1 first to 4 last): the player's `setBuild`, else the content's start. */
function pastureLevel(world: WorldState): number {
  const row = (world.entities['want'] ?? []).find((r) => r['kind'] === 'pasture');
  return row ? (row['level'] as number) : def.pasture.start;
}

/** The Pasture row: shown while tameable wild herds live in the valley or a pasture is live. */
export function pastureRow(world: WorldState): PastureRow | undefined {
  const p = livePastures(world)[0];
  const wild = wildNeed(world);
  if (!p && !wild) return undefined;
  const level = pastureLevel(world);
  const want = { level, word: content.work.priority.words[level - 1] ?? '' };
  const holds = def.pasture.holds;
  if (!p)
    return { want, need: `a pasture for ${holds} head. ${wild}, and the colony keeps no flock` };
  const flock = flockOf(world, p.id);
  const kept = flock ? headOf(world, flock) : 0;
  const state = p['state'] as string;
  const [up, all] = hurdles(world, p);
  const tiles = ((p['w'] as number) - 2) * ((p['h'] as number) - 2);
  const meadow = (p['mw'] as number) * (p['mh'] as number);
  return {
    want,
    need: `a pasture for ${holds} head; the colony keeps ${kept ? kept : 'no flock yet'}`,
    plan: {
      id: p.id,
      state,
      words:
        `${tiles} tiles of grass with a fold in its corner and a ${meadow}-tile hay meadow beside it, ` +
        `${whereOf(world, p)} of the green: ${state === 'built' ? 'built' : 'planned'}.` +
        (state === 'built' ? '' : ` Hurdles: ${up} of ${all} up.`),
      why: p['why'] as string,
      back: state === 'plan' && !p['sent'] && up === 0,
      sent: !!p['sent'],
    },
  };
}

/** The Stock sheet's flock plate: every live flock's head and the hay in the ricks together. */
export function flockPlate(world: WorldState): FlockPlate | undefined {
  const flock = flocksOf(world)[0];
  return flock
    ? {
        head: headParts(world, flock).map((h) => [
          cap(speciesWord(h.species, h.n)),
          `${h.n} kept (${h.text})`,
        ]),
        hay: hayWords(world, flock),
      }
    : undefined;
}

/** What a meadow tile shows: uncut, cut and drying, dried and ready, or mown and carried. */
export function meadowFrame(flock: EntityRow, tile: number): string {
  const k = (flock['swaths'] as number[]).indexOf(tile);
  if (k >= 0)
    return (flock['swathDry'] as number[])[k]! >= def.hay.dry ? 'pasture.cocks' : 'pasture.swath';
  return (flock['mown'] as number[]).includes(tile) ? 'pasture.stubble' : 'pasture.meadow';
}

/** The rick's frame by hay in thirds of the full winter's, none when empty. */
export function rickFrame(flock: EntityRow): string | undefined {
  const hay = flock['hay'] as number;
  if (!hay) return undefined;
  const full = def.pasture.holds * def.hay.plan;
  return `pasture.rick.${Math.min(3, Math.max(1, Math.ceil((hay * 3) / full)))}`;
}

/** The meadow and rick frames for the map, grouped like the field frames: one picture a tile,
 * drawn for each built pasture's flock. */
export function pastureFrames(world: WorldState): GoodsView['fields'] {
  const groups = new Map<string, number[]>();
  const add = (frame: string, i: number) => groups.set(frame, [...(groups.get(frame) ?? []), i]);
  for (const f of flocksOf(world)) {
    const p = pasturesOf(world).find((r) => r.id === f['pasture']);
    if (!p || p['state'] === 'sent') continue;
    for (const i of meadowTiles(world.map.width, p)) add(meadowFrame(f, i), i);
    const rick = rickFrame(f);
    if (rick) add(rick, p['rick'] as number);
  }
  return [...groups].map(([frame, tiles]) => ({ frame, tiles }));
}
