// The pages of the pasture, its fold, its hay meadow, its rick and a kept animal (Phase 5 Bundle 3):
// words from the engine's answers, read-only. The only levers are the Build sheet's Pasture row
// and the Work sheet's Herding row (V-041), so nothing here sends a command.
import { content } from '../content/index.ts';
import {
  animalWord,
  clockAt,
  daysTo,
  flockOf,
  foldTiles,
  headOf,
  hurdleTiles,
  keptOf,
  levelOf,
  meadowTiles,
  pasturesOf,
  recordOf,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import {
  cap,
  cornerWord,
  hayWords,
  headParts,
  meadowFrame,
  num,
  speciesOf,
  speciesWord,
  whereOf,
} from './flock.ts';
import type { LedgerLine } from './protocol.ts';
import type { AnimalPage } from './protocol-wild.ts';

type LineOf = (e: SimEvent | Stub) => LedgerLine;
const { flock: def } = content;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** A flock's latest lines, newest first, each once: the flock's own, the cull's, the pack's
 * taking and the pasture's latest and sitting. */
function linesOf(
  world: WorldState,
  rows: readonly (EntityRow | undefined)[],
  keys: string[],
  lineOf: LineOf,
): LedgerLine[] {
  const ids = new Set<number>();
  for (const r of rows)
    for (const k of keys) {
      const id = r?.[k];
      if (typeof id === 'number' && id > 0) ids.add(id);
    }
  return [...ids]
    .sort((a, b) => b - a)
    .flatMap((id) => {
      const e = recordOf(world, id);
      return e ? [lineOf(e)] : [];
    })
    .slice(0, 3);
}

/** Who herds, by the level each puts Herding at: "first: Zharra; third: Gorek, Throkk". */
function herders(world: WorldState): string {
  const words = content.work.priority.words;
  const people = (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
  return words
    .flatMap((word, n) => {
      const names = people
        .filter((p) => levelOf(world, content, p.id, def.job) === n + 1)
        .map((p) => (p['name'] as string).split(' ')[0]!);
      return names.length ? [`${word}: ${names.join(', ')}`] : [];
    })
    .join('; ');
}

/** The head of a flock in one row: "7 sheep: 1 ram, 4 ewes, 2 lambs", species apart. */
function flockRow(world: WorldState, flock: EntityRow | undefined): string {
  if (!flock || !headOf(world, flock)) return 'none kept yet';
  return headParts(world, flock)
    .map((h) => `${h.n} ${speciesWord(h.species, h.n)}: ${h.text}`)
    .join('; ');
}

const feeding = (flock: EntityRow | undefined): string =>
  flock?.['onHay']
    ? 'hay from the rick, since the first snow'
    : `on the grass until the first snow, then hay until ${def.hay.thaw}`;

type Part = 'pasture' | 'fold' | 'meadow' | 'rick';

/** Which part of a live pasture tile `i` is: its rick, hay meadow, fold or grazing ground. The
 * hurdles are a built part's own page, not this one. */
function partAt(world: WorldState, p: EntityRow, i: number): Part | undefined {
  const w = world.map.width;
  if (p['rick'] === i) return 'rick';
  if (meadowTiles(w, p).includes(i)) return 'meadow';
  if (hurdleTiles(content, w, p).some((h) => h.i === i)) return undefined;
  if (foldTiles(w, p).includes(i)) return 'fold';
  const [x, y] = [i % w, Math.floor(i / w)];
  const inside =
    x > (p['x'] as number) &&
    y > (p['y'] as number) &&
    x < (p['x'] as number) + (p['w'] as number) - 1 &&
    y < (p['y'] as number) + (p['h'] as number) - 1;
  return inside ? 'pasture' : undefined;
}

/** The page of the pasture ground a surface tile belongs to, if any. */
export function tilePasture(
  world: WorldState,
  x: number,
  y: number,
  lineOf: LineOf,
): { pasture?: AnimalPage } {
  const i = y * world.map.width + x;
  for (const p of pasturesOf(world)) {
    if (p['state'] === 'sent') continue;
    const part = partAt(world, p, i);
    if (part) return { pasture: pageOf(world, p, part, i, lineOf) };
  }
  return {};
}

function pageOf(
  world: WorldState,
  p: EntityRow,
  part: Part,
  tile: number,
  lineOf: LineOf,
): AnimalPage {
  const flock = flockOf(world, p.id);
  const f = def.pasture.fold;
  const holds = `${def.pasture.holds} head on its grass`;
  const hay = flock ? hayWords(world, flock) : 'none: no flock yet';
  const mow = meadowCounts(flock, p);
  const base = {
    id: p.id,
    lines: linesOf(world, [flock, p], ['line', 'cullLine', 'takenLine', 'last'], lineOf),
  };
  const herd: [string, string] = ['Herders', `by Herding priority, ${herders(world)}`];
  // While the flock eats hay: how long until the grass is back.
  const thaw = flock?.['onHay']
    ? `; ${def.hay.thaw}'s grass is ${plural(daysTo(world, content, def.hay.thaw), 'day')} off`
    : '';
  if (part === 'fold')
    return {
      ...base,
      title: 'Fold',
      who: `The pasture's fold, wattle hurdles, ${f} by ${f}, in its ${cornerWord(p)} corner`,
      rows: [
        ['Flock', flockRow(world, flock)],
        ['Feeding', feeding(flock)],
        ['Hay in the rick', hay + thaw],
        ['Shut in', shutIn(flock)],
        ['Watch', watchRow(world, flock)],
        herd,
      ],
    };
  if (part === 'meadow')
    return {
      ...base,
      title: 'Hay meadow',
      who: `A hay meadow of ${(p['mw'] as number) * (p['mh'] as number)} tiles beside the pasture, ${whereOf(world, p)} of the green`,
      rows: [
        ['This tile', flock ? tileWords(flock, tile) : 'uncut grass'],
        ['Meadow', mow],
        [
          'Hay this year',
          flock
            ? `${num(flock['hay'] as number)} in the rick${flock['spoiled'] ? `, ${num(flock['spoiled'] as number)} spoiled by rain` : ''}`
            : 'none yet',
        ],
        [
          'Mowing',
          `${def.hay.months.join(' and ')}, only after a dry night; cut hay dries ${plural(def.hay.dry, 'dry day')}`,
        ],
        herd,
      ],
    };
  if (part === 'rick')
    return {
      ...base,
      title: 'Hay rick',
      who: `The pasture's hay rick, beside the fold, ${whereOf(world, p)} of the green`,
      rows: [['Hay in the rick', hay + thaw], ['Feeding', feeding(flock)], herd],
    };
  return {
    ...base,
    title: 'Pasture',
    who: `Wattle hurdles round ${((p['w'] as number) - 2) * ((p['h'] as number) - 2)} tiles of grass, ${whereOf(world, p)} of the green`,
    rows: [
      ['Flock', flockRow(world, flock)],
      ['Holds', holds],
      [
        'Fold',
        `${f} by ${f} hurdles in the ${cornerWord(p)} corner, nearest town; ${flock?.['folded'] ? 'the flock is shut in now' : 'the flock is shut in at dusk'}`,
      ],
      ['Feeding', feeding(flock)],
      ['Hay meadow', mow],
      ['Hay in the rick', hay],
      ['Fleece', fleeceRow(world, flock)],
      herd,
    ],
  };
}

const shutIn = (flock: EntityRow | undefined): string =>
  flock?.['folded']
    ? 'shut in now; let out at dawn'
    : flock?.['outLine']
      ? 'out tonight: nobody shut it in'
      : 'at dusk by whoever puts Herding highest';

/** Tonight's watch (Bundle 6): who sits up by the fire at the gate, since when and why, from the
 * `flock.watchLit` line; else who will on a night after the pack comes near. */
function watchRow(world: WorldState, flock: EntityRow | undefined): string {
  const lit = flock?.['watch'] ? recordOf(world, flock['watch'] as number) : undefined;
  if (lit && 'data' in lit) {
    const data = lit.data as Record<string, unknown>;
    const c = clockAt(lit.tick, content.calendar);
    const hhmm = `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
    return `${String(data['name'])}, by a fire at the gate since ${hhmm}: ${String(data['why'])}. ${def.watch.firewood} firewood for the night.`;
  }
  if (flock?.['watchBy']) return 'going to the gate to light the watch fire';
  return `none tonight; on the ${def.watch.nights} nights after the pack comes near, whoever puts Herding highest sits up by a fire`;
}

/** "18 mown and drying, 2 cocks made": the meadow's tiles by what they are now. */
function meadowCounts(flock: EntityRow | undefined, p: EntityRow): string {
  const n = (p['mw'] as number) * (p['mh'] as number);
  if (!flock) return `${plural(n, 'tile')}, uncut`;
  const swaths = flock['swaths'] as number[];
  const dry = (flock['swathDry'] as number[]).filter((d) => d >= def.hay.dry).length;
  const drying = swaths.length - dry;
  const mown = (flock['mown'] as number[]).length;
  return `${plural(n, 'tile')}: ${mown} mown, ${drying} drying, ${plural(dry, 'cock')} ready`;
}

function tileWords(flock: EntityRow, tile: number): string {
  const words: Record<string, string> = {
    'pasture.meadow': 'uncut grass',
    'pasture.swath': 'cut and drying',
    'pasture.cocks': 'dried, made into cocks, ready to carry',
    'pasture.stubble': 'mown and carried',
  };
  return words[meadowFrame(flock, tile)]!;
}

/** "5 of 6 grown sheep shorn this year", or none yet while there is no flock. */
function fleeceRow(world: WorldState, flock: EntityRow | undefined): string {
  if (!flock) return 'none yet';
  const year = clockAt(world.tick, content.calendar).year + 1;
  const grown = keptOf(world, flock).filter(
    (a) => !a['young'] && def.kinds.find((k) => k.species === speciesOf(world, a))!.fleece,
  );
  const shorn = grown.filter((a) => a['shorn'] === year).length;
  return grown.length
    ? `${shorn} of ${grown.length} grown shorn this year; fleece goes to the store`
    : 'none yet';
}

/** The page of a kept animal: its kind word, age, who tamed it and whether it is marked to cull. */
export function keptPage(
  world: WorldState,
  animal: EntityRow,
  herd: EntityRow,
  lineOf: LineOf,
): AnimalPage {
  const flock = flockOf(world, herd['kept'] as number)!;
  const word = animalWord(content, animal);
  const by = animal['tamedBy'] as number;
  const who = by ? (world.entities['person'] ?? []).find((q) => q.id === by) : undefined;
  const kd = def.kinds.find((k) => k.species === speciesOf(world, animal))!;
  const rows: [string, string][] = [
    ['Kind', `${word}, ${animal['young'] ? 'young' : 'grown'}`],
    ['Tamed by', who ? String(who['name']) : animal['born'] ? 'born in the flock' : 'caught wild'],
    ['Marked to cull', animal['cull'] ? 'yes: the rick cannot feed it through the winter' : 'no'],
    ['Flock', flockRow(world, flock)],
    ...(kd.fleece && !animal['young']
      ? [
          [
            'Fleece',
            animal['shorn'] === clockAt(world.tick, content.calendar).year + 1
              ? 'shorn this year'
              : 'not shorn this year',
          ] as [string, string],
        ]
      : []),
  ];
  return {
    id: animal.id,
    title: cap(word),
    who: `${animal['young'] ? 'A young' : 'A grown'} ${word} of the pasture's flock, ${folded(flock)}`,
    rows,
    lines: linesOf(world, [flock], ['cullLine', 'line'], lineOf).slice(0, 2),
  };
}

const folded = (flock: EntityRow): string =>
  flock['folded'] ? 'shut in the fold' : 'out on the pasture';
