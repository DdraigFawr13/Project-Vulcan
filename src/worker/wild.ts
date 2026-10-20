// The wild valley as the page shows it (Phase 5A Bundle 2): the animals on the map, the herd and
// pack pages, a tile's prints and snow, and the Stock sheet's leftovers. Pure reads of the world
// and content, like views.ts; every word is made here (GAME-02).
import { content } from '../content/index.ts';
import {
  animalsOf,
  dirFrom,
  entityOf,
  greenOf,
  haveOf,
  herdsOf,
  packOf,
  printsAt,
  recordOf,
  spareCount,
  TICKS_PER_DAY,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { LedgerLine, TileView } from './protocol.ts';
import type { AnimalPage, AnimalView, LeftoversView } from './protocol-wild.ts';

type LineOf = (e: SimEvent | Stub) => LedgerLine;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
];

/** The live animals on the surface, in id order. */
export function animalsView(world: WorldState): AnimalView[] {
  return animalsOf(world).map((a) => ({
    id: a.id,
    kind: a['kind'] as string,
    x: a['x'] as number,
    y: a['y'] as number,
    facing: a['facing'] === 'w' ? 'w' : 'e',
    moving: (a['path'] as number[]).length > 0 || a['state'] === 'flee',
  }));
}

/** Remembers the animals last sent: `next` gives the list only when it differs from that. */
export function animalFeed(): { next(w: WorldState): AnimalView[] | undefined; reset(): void } {
  let sent = '';
  return {
    next(w) {
      const list = animalsView(w);
      const key = JSON.stringify(list);
      if (key === sent) return undefined;
      sent = key;
      return list;
    },
    reset: () => void (sent = ''),
  };
}

/** The hides, bone and fat in the colony's hands, and the game and fish counted as food. */
export function leftoversView(world: WorldState): LeftoversView {
  const name = (id: string): string => content.items.find((i) => i.id === id)?.name ?? id;
  return {
    items: ['hide', 'bone', 'fat'].map((item) => ({
      item,
      name: name(item),
      have: haveOf(world, content, item),
    })),
    game: haveOf(world, content, 'game'),
    fish: haveOf(world, content, 'fish'),
  };
}

/** How far and which way (x, y) lies from the green: "14 tiles north-east of the green". */
function fromGreen(world: WorldState, x: number, y: number): string {
  const green = greenOf(world);
  const far = Math.max(Math.abs(x - green.x), Math.abs(y - green.y));
  if (far === 0) return 'at the green';
  const dir = dirFrom(green, { x, y, w: 1, h: 1 });
  return `${plural(far, 'tile', 'tiles')} ${dir} of the green`;
}

/** The ground at a tile in words ("in the woods"), from content. */
function groundWords(world: WorldState, x: number, y: number): string {
  const biome = content.biomes.biomes[world.map.biomes[y * world.map.width + x]!]!.id;
  return content.wild.where[biome] ?? content.wild.where['default']!;
}

/** A herd or pack's latest line and the wild line it cites, newest first (at most two); a herd
 * placed at the start shows none rather than "A new world began". */
function lastTwo(world: WorldState, id: unknown, lineOf: LineOf): LedgerLine[] {
  const first = typeof id === 'number' && id ? recordOf(world, id) : undefined;
  if (!first || id === world.begunEvent) return [];
  const out = [lineOf(first)];
  const cause = ('causes' in first ? (first.causes as number[]) : [])[0];
  const second = cause ? recordOf(world, cause) : undefined;
  if (second && second.type.startsWith('wild.')) out.push(lineOf(second));
  return out;
}

/** The page of the herd or pack animal `id` belongs to; undefined once it is gone. */
export function animalPage(world: WorldState, id: number, lineOf: LineOf): AnimalPage | undefined {
  const animal = entityOf(world, 'animal', id);
  if (!animal) return undefined;
  const herd = animal['herd'] ? entityOf(world, 'herd', animal['herd'] as number) : undefined;
  return herd ? herdPage(world, id, herd, lineOf) : packPage(world, id, animal, lineOf);
}

function herdPage(world: WorldState, id: number, herd: EntityRow, lineOf: LineOf): AnimalPage {
  const sp = content.wild.species.find((s) => s.id === herd['species'])!;
  const members = animalsOf(world).filter((a) => a['herd'] === herd.id);
  const [hx, hy] = [herd['x'] as number, herd['y'] as number];
  const kinds = [...new Set(sp.kinds)];
  const makeup =
    kinds.length > 1
      ? kinds
          .map((k) => [k, members.filter((a) => a['kind'] === k).length] as const)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${n} ${n === 1 ? k : `${k}s`}`)
          .join(', ')
      : `${members.length}`;
  const taken = [
    ...(herd['taken'] ? [`${herd['taken']} by the band`] : []),
    ...(herd['byPack'] ? [`${herd['byPack']} by the pack`] : []),
    ...(herd['bySnow'] ? [`${herd['bySnow']} lost to the snow`] : []),
  ];
  const rows: [string, string][] = [
    ['Herd', makeup],
    ['Taken this year', taken.join(', ') || 'none yet'],
    ['Spared', `hunters leave its last ${spareCount(content)}`],
    ...tracksRow(world, sp, hx, hy, herd['radius'] as number),
  ];
  return {
    id,
    title: cap(sp.name),
    who: `A herd of ${members.length} ${groundWords(world, hx, hy)}, ${fromGreen(world, hx, hy)}`,
    rows,
    lines: lastTwo(world, herd['line'], lineOf),
  };
}

/** The Tracks row: fresh prints of the species' feet within its range, in snow or in mud. */
function tracksRow(
  world: WorldState,
  sp: (typeof content.wild.species)[number],
  x: number,
  y: number,
  radius: number,
): [string, string][] {
  const map = world.map;
  const kind = content.wild.prints.findIndex((p) => p.id === sp.print) + 1;
  let found = 0;
  let snow = false;
  for (let row = Math.max(0, y - radius); row <= Math.min(map.height - 1, y + radius); row += 1)
    for (let col = Math.max(0, x - radius); col <= Math.min(map.width - 1, x + radius); col += 1) {
      const i = row * map.width + col;
      if (map.printKind[i] !== kind || !printsAt(world, content, i)) continue;
      found += 1;
      snow ||= map.snowLie[i] === 1;
    }
  if (!found) return [];
  return [
    [
      'Tracks',
      `in the ${snow ? 'snow' : 'mud'} today; they fade in about ${plural(content.wild.printHours, 'hour', 'hours')}`,
    ],
  ];
}

function packPage(world: WorldState, id: number, animal: EntityRow, lineOf: LineOf): AnimalPage {
  const pack = packOf(world) ?? world.entities['pack']?.[0];
  const pred = content.wild.predators.find((p) => p.kind === animal['kind'])!;
  const title = cap(pred.name);
  if (!pack) return { id, title, who: 'A lone beast of the wild', rows: [], lines: [] };
  const size = pack['size'] as number;
  const hunger = pack['hunger'] as number;
  const { pack: dials } = content.wild;
  const word = hunger >= dials.visit ? 'starving' : hunger >= dials.hungry ? 'hungry' : 'fed';
  const [dx, dy] = [pack['denX'] as number, pack['denY'] as number];
  const days = Math.floor((world.tick - (pack['lastKill'] as number)) / TICKS_PER_DAY);
  const rows: [string, string][] = [
    [
      'Pack',
      `${size} ${size === 1 ? pred.name : pred.kind === 'wolf' ? 'wolves' : `${pred.name}s`}`,
    ],
    ['Den', `${groundWords(world, dx, dy)}, ${fromGreen(world, dx, dy)}`],
    ['Last kill', days < 1 ? 'today' : `${plural(days, 'day', 'days')} ago`],
    ['Hunger', word],
    ['Game in the valley', gameLine(world)],
  ];
  const hit = pack['attacked'] ? recordOf(world, pack['attacked'] as number) : undefined;
  if (hit && world.tick - hit.tick <= 7 * TICKS_PER_DAY)
    rows.push([
      'Hunted by',
      'whoever puts Hunting highest follows its fresh tracks, since it went for someone',
    ]);
  return {
    id,
    title,
    who: `One of ${low(pack['name'] as string)}`,
    rows,
    lines: lastTwo(world, pack['line'], lineOf),
  };
}

/** "4 deer and 9 hares", or "none". */
function gameLine(world: WorldState): string {
  const species = new Map(herdsOf(world).map((h) => [h.id, h['species'] as string]));
  const counts = new Map<string, number>();
  for (const a of animalsOf(world)) {
    const s = species.get(a['herd'] as number);
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const parts = content.wild.species.flatMap((s) => {
    const n = counts.get(s.id) ?? 0;
    return n ? [`${n} ${n === 1 ? s.name : s.plural}`] : [];
  });
  if (parts.length < 2) return parts[0] ?? 'none';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** A tile's prints and snow rows, surface tile `i`. */
export function tileWild(world: WorldState, i: number): Partial<TileView> {
  const print = printsAt(world, content, i);
  const hours = print && print.ageHours;
  const left = content.wild.printHours - (hours ?? 0);
  return {
    ...(print && {
      prints: `${print.name}, ${hours ? `about ${plural(hours, 'hour', 'hours')} old` : 'under an hour old'}, heading ${COMPASS[print.dir] ?? 'north-west'}`,
      fade: `gone in about ${plural(left, 'hour', 'hours')}`,
    }),
    ...(world.map.snowLie[i] && {
      snowLies: `lying; it goes on the next day above about ${content.seasons.snowMelt} °C`,
    }),
  };
}
