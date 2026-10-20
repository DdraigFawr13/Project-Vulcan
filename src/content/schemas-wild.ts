// Shape of Vulcan's wild-valley file (src/content/data/wild.json, Phase 5 Bundle 2, V-110 to
// V-112, V-122): the game herds, the one predator pack and the prints both leave. Every dial the
// wild system (src/engine/wild) reads is here; chances are shares of 1, distances are tiles.
import { list, map, num, obj, opt, range, ref, str } from './schema';
import { count, id, share, text, texts } from './schema-fields';

const leftovers = list(obj({ item: ref('items'), count: num({ min: 1 }) }));

export const WILD_SCHEMAS = {
  wild: obj({
    // Game. `kinds` are art kinds laid over a herd's animals in turn (so a herd of deer is mostly
    // hinds); `habitat` weights biomes towards the herd count (herds = weighted tiles / `perHerd`),
    // an `edge` biome limiting placement to within that many tiles of a tree; `ground` limits where a
    // herd is placed to those terrain kinds, and with `foot` it may be on that ground off the
    // biome, within that many tiles of it (goats on the scree below the peaks). `breed.rate` is a year's births per animal, spread over
    // `months`; `cap` is the most a herd grows to.
    species: list(
      obj({
        id,
        name: text,
        plural: text,
        kinds: list(str()),
        print: ref('wild-prints'),
        meat: count,
        leftovers,
        flee: num({ min: 1 }),
        // Animals to one unit of the valley's game (a hare is a sixth of a deer for the pack).
        perGame: num({ min: 1 }),
        size: range(),
        habitat: list(obj({ biome: ref('biomes'), weight: count, edge: opt(num({ min: 1 })) })),
        ground: opt(list(ref('terrain'))),
        foot: opt(num({ min: 1 })),
        perHerd: num({ min: 1 }),
        cap: num({ min: 1 }),
        breed: obj({ months: texts, rate: share }),
      }),
    ),
    // The predators, in the order they are tried: the first whose creature lives in a biome of
    // the valley takes the range, the last is the fallback. Names come from the creature's own.
    predators: list(
      obj({
        kind: id,
        name: text,
        creature: ref('creatures'),
        size: range(),
        print: ref('wild-prints'),
        meat: count,
        leftovers,
      }),
    ),
    prints: list(obj({ id, name: text })),
    // Terrain kinds that take a print on a wet day (snow takes one on any ground).
    soft: list(ref('terrain')),
    printHours: num({ min: 1 }),
    // Hunters leave each herd its last `spare`.
    spare: count,
    // Placement: tiles from the start at least `start`, herds `apart`, the range's `radius`, draws
    // at a spot (`tries`) and how far from its centre an animal starts (`spread`).
    place: obj({
      start: count,
      apart: count,
      radius: num({ min: 1 }),
      tries: num({ min: 1 }),
      spread: count,
    }),
    // Minutes between steps; a fleeing animal steps every `fleeEvery` for `fleeFor` minutes; the pack on its way to
    // or from the town's edge every `trot`;
    // `wander` is the chance in 100 a resting animal sets out; `reach` the longest way it walks.
    move: obj({
      every: num({ min: 1 }),
      fleeEvery: num({ min: 1 }),
      trot: num({ min: 1 }),
      fleeFor: num({ min: 1 }),
      wander: num({ min: 0, max: 100 }),
      reach: num({ min: 1 }),
    }),
    winter: texts,
    // A herd is low at this per cent of its starting size; `snowLoss` is a snow-lying day's loss per
    // animal at a full herd (less in a smaller one).
    low: num({ min: 1, max: 100 }),
    snowLoss: share,
    pack: obj({
      // The den: at least `from` tiles from the start, scored by the trees within `radius` tiles
      // and by distance from the start up to `far`.
      den: obj({ from: count, radius: count, far: count }),
      // The nearest neighbour's stand-in on a plain seed, and how far the pack roams about its den.
      near: text,
      roam: count,
      // Chance a day the pack eats beyond the valley, in winter months and out, the hard
      // weather's factor, then the in-valley chance at `gameFull` units of game (species `perGame`)
      // and its factor when snow lies on `snowMost` per cent of open ground.
      offMap: share,
      offMapWinter: share,
      harsh: ref('weather'),
      harshFactor: share,
      inValley: share,
      gameFull: num({ min: 1 }),
      snowFactor: num({ min: 1 }),
      snowMost: num({ min: 1, max: 100 }),
      // Hungry lines at `hungry` days without a meal and each `hungryEvery` after; at `visit` days
      // the pack walks to the edge of town by night (`night`), at most every `visitEvery` days.
      hungry: num({ min: 1 }),
      hungryEvery: num({ min: 1 }),
      visit: num({ min: 1 }),
      visitEvery: num({ min: 1 }),
      night: obj({ from: count, to: count }),
      // A pack smaller than `least` leaves; a new one may come on the first day of `returns.month`.
      least: num({ min: 1 }),
      returns: obj({ month: text, chance: share }),
      why: obj({ harsh: text, winter: text, other: text }),
      left: obj({ dead: text, few: text }),
      where: obj({ edge: text, midden: text }),
    }),
    // Words for a herd's ground by biome id, with a `default`.
    where: map(text),
  }),
};
