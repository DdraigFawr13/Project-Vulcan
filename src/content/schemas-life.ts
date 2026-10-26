// Shape of Vulcan's own life and work files (src/content/data/life.json, P2.2): needs, sleep, warmth,
// leisure, what each food gives, mood words, and the cart the band arrives with. Need values run
// from 0 to `scale`; rates are per game hour.
import { bool, list, map, num, obj, oneOf, opt, ref, str } from './schema';
import { count, id, text, texts } from './schema-fields';
import { COOK, COOPER, CURE, KEEP, POTTER } from './schemas-food';
import { TOWN_SCHEMAS } from './schemas-town';

// A house size or stage: a footprint of walls round a floor, and how many it sleeps.
const size = obj({
  id,
  name: text,
  w: num({ min: 3 }),
  h: num({ min: 3 }),
  sleeps: num({ min: 1 }),
});

export const LIFE_SCHEMAS = {
  life: obj({
    scale: num({ min: 100 }),
    // A need back this far above its warning line is met again (one line, not one a minute).
    again: count,
    // Each need falls `fall` an hour; under `low` it is a warning (a ledger line); under `seek`
    // the person goes to put it right. Weights make the mood.
    needs: list(
      obj({
        id,
        name: text,
        fall: count,
        low: count,
        seek: count,
        lowWord: text,
        okWord: text,
        weight: num({ min: 1 }),
        // `quiet`: warning line notable once a person a day (V-092); `asleepFall`: fall asleep.
        quiet: opt(bool()),
        asleepFall: opt(count),
      }),
    ),
    // Each need's value when the band arrives, in the order of `needs`.
    start: list(count),
    // Rest an hour asleep in a bed (P3.5), on a bedroll or on the bare ground; bedtime and rising
    // hours; awake when rest reaches `wake`.
    sleep: obj({ bed: count, bedroll: count, ground: count, from: count, to: count, wake: count }),
    // Beauty (P3.5): awake indoors it moves `rate` an hour towards `neutral` plus `perPoint` for
    // each point of the room's beauty, outdoors `outdoors` an hour towards `neutral`.
    beauty: obj({ neutral: count, perPoint: count, rate: count, outdoors: count }),
    // Privacy (P3.5): each hour asleep in a room whose every bed is theirs alone it rises `gain`;
    // asleep with others in the room it falls `perOther` for each of them.
    privacy: obj({ gain: count, perOther: count }),
    // Comfortable at `comfort` °C or warmer (`bedroll` degrees warmer asleep in one): warmth
    // rises `rise` an hour (plus `catchUp` of the way back to the warning line), else falls
    // `perDegree` for each degree short. Underground is `below`.
    warmth: obj({
      comfort: num(),
      bedroll: count,
      rise: count,
      catchUp: num({ min: 0, max: 1 }),
      perDegree: count,
      below: num(),
    }),
    // Leisure from `from` o'clock to bedtime: recreation gains `gain` an hour, `company` more
    // with someone else at leisure within `reach` tiles.
    relax: obj({ from: count, gain: count, company: count, reach: count }),
    // Food each item gives when one is eaten.
    eat: map(count, 'items'),
    // Foods eaten only when a person is under the food warning line and no other can be reached
    // (P4.7: seed grain).
    lastResort: list(ref('items')),
    // They eat it only with Food at or under `seedAt`.
    seedAt: count,
    // Mood words, highest first: the first whose `at` the mood reaches.
    mood: list(obj({ word: text, at: count })),
    // The band's handcart and what it carries; each person also brings a `bedroll`.
    cart: obj({
      kind: ref('items'),
      goods: list(obj({ kind: ref('items'), count: num({ min: 1 }) })),
      bedroll: ref('items'),
      // Each person also arrives wearing one of these (V-092).
      cloak: ref('items'),
    }),
    // Memories (V-091): each live memory's mood, in points, counts `weight` times in the mood.
    memory: obj({ weight: count }),
    // The warmth warning line moves by temperament and memories (V-046): points a trait or a held
    // memory adds to it, each memory row counted (P4.8).
    warmthLine: obj({ traits: map(num(), 'traits'), memories: map(num(), 'memories') }),
    // The wool cloak (V-092): outdoors it adds `warmth` degrees to the felt temperature; each hour
    // outdoors below comfort it wears `wear`, from `last`; at 0 it is gone.
    cloak: obj({ warmth: num(), wear: num({ min: 1 }), last: num({ min: 1 }) }),
    // Most of one kind a tile's stack holds (`default` for the rest).
    stacks: map(count),
  }),
  // P2.4: the colony's work (work.json). Stock levels are the player's lever (V-015): how much
  // of a good the colony wants kept; nobody is ever told what to do.
  work: obj({
    stock: list(
      obj({
        // An item id (logs) or the `good` items.json groups items under (food).
        good: str(),
        name: text,
        levels: list(obj({ id, word: text, count })),
        start: str(),
        // A line under the plate saying what the good is for.
        note: opt(text),
      }),
    ),
    // Felling: the jobs.json job (its skill and strength), minutes a tree takes at skill
    // `skilled` (longer below, shorter above), never within `camp` tiles of the start, trees
    // looked for within `reach` tiles of the store.
    fell: obj({ job: ref('jobs'), minutes: count, skilled: count, camp: count, reach: count }),
    // Quarrying (P3.1): breaking up boulders for stone, the same shape as felling, for `good`.
    quarry: obj({
      job: ref('jobs'),
      good: ref('items'),
      minutes: count,
      skilled: count,
      camp: count,
      reach: count,
    }),
    // Mining (P4.1, V-086, V-087): the jobs.json job; minutes to sink a shaft one level, dig a
    // rock or earth tile and mine a vein tile at skill `skilled`; the `ladder` items (item: count)
    // the first level takes (ore an ingot wants is the smelting recipe's, metal.json); `floors` the tile kind digging leaves, by what was dug.
    mine: obj({
      job: ref('jobs'),
      shaft: count,
      dig: count,
      vein: count,
      skilled: count,
      ladder: map(count, 'items'),
      floors: obj({ stone: str(), earth: str() }),
      // A shaft may sit up to `near` tiles from its stain, on the nearest open ground; not within
      // `avoid` tiles of a plan sent back or a shaft spent; on ground whose walking multiplier is
      // at most `walk` (1 is plain ground). `why` is the sentence a shaft plan gives for itself
      // ({Metal}, {metal}, {have}, {want}, {word}, {far}, {dir}); `words` say what each mining
      // task is, in the taking-up line ({m} is the metal).
      near: count,
      avoid: count,
      walk: num({ min: 1 }),
      why: text,
      words: obj({ sink: text, tunnel: text, mine: text, clay: text, cellar: text }),
    }),
    // Foraging (P2.9): the jobs.json job and the good it serves, minutes a bush takes at skill
    // `skilled`, bushes looked for within `reach` tiles of the store; a bush picked is ripe again
    // after `regrowDays` days, and bushes only grow back in the named `months`.
    forage: obj({
      job: ref('jobs'),
      good: str(),
      minutes: count,
      skilled: count,
      reach: count,
      regrowDays: count,
      months: list(text),
      // Herbs (Bundle 6): gathered by the same foragers, after food, into the `good`'s plate.
      herbs: obj({ good: str(), months: list(text), regrowDays: count }),
    }),
    // Farming (P4.7): the jobs.json job, minutes to sow or reap one tile at skill `skilled`
    // (longer below, shorter above).
    farm: obj({ job: ref('jobs'), sow: count, reap: count, muck: count, skilled: count }),
    // Hunting (P5.4a): see WorkDef.hunt.
    hunt: obj({
      job: ref('jobs'),
      crew: count,
      from: num({ min: 1, max: 100 }),
      near: count,
      every: num({ min: 1 }),
      chance: count,
      perLevel: count,
      most: count,
      snare: obj({ species: list(str()), every: num({ min: 1 }) }),
      follow: obj({ hours: count, ahead: count }),
      pack: obj({ level: count }),
    }),
    // Fishing: see WorkDef.fish.
    fish: obj({
      job: ref('jobs'),
      crew: count,
      from: num({ min: 1, max: 100 }),
      every: num({ min: 1 }),
      chance: count,
      perLevel: count,
      most: count,
      count: num({ min: 1 }),
      water: list(str()),
      reach: count,
    }),
    // The midden (V-072): see WorkDef.midden.
    midden: obj({ past: count, apart: count, walk: num({ min: 1 }) }),
    // Fire (P3.6, V-042 to V-048): a fire gives `heat` degrees at its own tile and `fall` fewer
    // for each tile away, over its closed room or, in the open, out to `radius` tiles. Each fuel
    // is an item: one piece burns `minutes` lit; banked, a fire gives `banked.heat` and burns
    // `banked.rate` times slower. `split` turns one `from` item into `per` pieces of a fuel in
    // `minutes`. `tend`: a fire under `low` minutes of fuel is refuelled first, one under
    // `topBelow` is topped up to at most `top`, a fire nobody used for `idle` minutes is left to
    // burn down, and the cold light a fire within `near` tiles.
    fire: obj({
      fall: count,
      radius: count,
      fuels: list(
        obj({
          id,
          item: ref('items'),
          minutes: num({ min: 1 }),
          heat: count,
          banked: obj({ heat: count, rate: num({ min: 1 }) }),
        }),
      ),
      split: obj({
        from: ref('items'),
        fuel: str(),
        per: num({ min: 1 }),
        minutes: num({ min: 1 }),
      }),
      tend: obj({
        low: count,
        top: count,
        topBelow: count,
        idle: count,
        near: count,
      }),
    }),
    // What a person is doing, in words (P2.9): `{good}` and `{level}` are the stock lever the
    // work answers, `{what}` the load carried.
    doing: map(text),
    // Carrying to the store: most a person carries at once, and which kinds are carried in.
    haul: obj({ load: num({ min: 1 }), kinds: list(ref('items')), midden: list(ref('items')) }),
    // The store the band sets up by the cart: its first size and the most tiles it grows to.
    store: obj({ width: num({ min: 1 }), height: num({ min: 1 }), most: count }),
    // The colony's day as it starts (P2.5, a lever since): work is taken up from `from` o'clock
    // until `to`; bedtime is `life.sleep.from`, and they are up for work at `from`.
    hours: obj({ from: count, to: count }),
    // Work priorities (P2.5): the kinds of work on the Work sheet, the level everyone starts at
    // (1 first to 4 last) and the word for each level.
    priority: obj({
      jobs: list(ref('jobs')),
      start: num({ min: 1, max: 4 }),
      words: list(text, 4),
      // Trades folded under a heading on the Work sheet (V-071): a heading's stepper sets every
      // row under it. Jobs under no heading (haul, build, tend) are plain rows on top.
      headings: list(obj({ name: text, jobs: list(ref('jobs')) })),
    }),
    keep: KEEP,
    cook: COOK,
    cure: CURE,
    cooper: COOPER,
    potter: POTTER,
    // Skills by use (P2.5): minutes of practice from one level to the next, `start` plus
    // `perLevel` times the level now.
    learn: obj({ start: num({ min: 1 }), perLevel: count }),
  }),
  // P3.1 and P3.2: the parts colonists build (buildings.json). Each part is one tile of one
  // material: `cost` of it delivered, then `minutes` of work at building skill `skilled`
  // (longer below, shorter above), by the jobs.json `job`; taking one down takes `downShare`
  // per cent of the minutes and gives the material back. A wall blocks the way, a door and a
  // floor do not, and a stair cuts a way down to the level below.
  buildings: obj({
    job: ref('jobs'),
    skilled: num({ min: 1 }),
    downShare: num({ min: 1, max: 100 }),
    parts: list(
      obj({
        id,
        name: text,
        kind: oneOf('wall', 'floor', 'door', 'stair', 'road'),
        material: ref('items'),
        cost: num({ min: 1 }),
        // A second material brought after the first (wattle and daub: clay, then logs).
        also: opt(obj({ material: ref('items'), cost: num({ min: 1 }) })),
        minutes: num({ min: 1 }),
        art: text,
      }),
    ),
    // P3.7 (V-049, V-051): what a house is made of and the sizes colonists choose from, smallest
    // first; `near` is how many tiles from the green it may stand. `walls` are part ids, the
    // first whose material lies within
    // `reach` tiles of the store taken. `stage` is the room a house adds (P3.8);
    // a crowded sleeper has one added for privacy while the house has fewer than `private` rooms.
    house: obj({
      name: text,
      start: num({ min: 1, max: 4 }),
      near: num({ min: 1 }),
      reach: num({ min: 1 }),
      walls: list(text),
      door: text,
      floor: text,
      sizes: list(size),
      stage: size,
      private: num({ min: 1, max: 8 }),
    }),
    // P4.7 (V-049, V-051, V-089): the town ring is the ground houses are sited in, `ring` tiles
    // (Chebyshev) from the green at first; when no house fits, it widens by `step`, up to `most`.
    // Fields lie outside it. A field is sized to `perMouth` tiles for each living person, its
    // seed tile chosen from open ground outside the ring and within `reach` of the green with
    // fertility at least `good` and water within `water` tiles, then grown over connected
    // tiles of fertility `good` or better, at least `least` of them. A crop is sown in its `sow`
    // months (calendar month names), is ripe `days` days later, yields `yield` of `item` per tile
    // and is lost to a frost under `frost` degrees C before it is ripe. `seed` is the item sown
    // (one a tile); a seed tile scores fertility x `weigh.fertility` less tiles to water x
    // `weigh.water` less tiles to the green, and the best `weigh.tries` are grown.
    // (P4.7 review) A field is one compact block as near square as fits, every tile good soil,
    // sited at the nearest such block to the ring's edge: a block scores its average fertility x
    // `weigh.fertility` less its tiles to water x `weigh.water` less its tiles past the ring x
    // `weigh.near`, and the best `weigh.tries` that can be reached are compared.
    // Bundle 3: the smithy, 3 deep by 4 along the best smith's house wall nearest water (search
    // `near` tiles for water); open-sided, a `floor` under each of `pieces` (furniture kinds).
    smithy: obj({
      name: text,
      start: num({ min: 1 }),
      depth: num({ min: 1 }),
      length: num({ min: 1 }),
      near: num({ min: 1 }),
      floor: text,
      pieces: texts,
    }),
    ...TOWN_SCHEMAS,
    // P3.3: rooms are worked out when asked. Impressiveness is the room's tiles over `perSize`
    // plus its beauty, out of `top`; beauty is the floors' average (`bare` where none is
    // built), less `crowd.beauty` when there is a bed for fewer than `crowd.tiles` tiles. The
    // first role whose `beds` the room has is its role.
    rooms: obj({
      // P3.6: a used room with no hearth gets one planned when its unheated temperature is
      // under `hearthBelow` degrees (a later workroom role may differ).
      hearthBelow: num(),
      most: num({ min: 1 }),
      roof: text,
      perSize: num({ min: 1 }),
      top: num({ min: 1 }),
      crowd: obj({ tiles: num({ min: 1 }), beauty: num() }),
      bare: num(),
      floors: map(num()),
      roles: list(obj({ id, name: text, beds: num({ min: 1 }) })),
      looks: list(obj({ at: num(), word: text })),
      // P3.4: what a room of a role lacks, in the order colonists make it: a piece for each
      // sleeper (`per: sleeper`) or one for the room.
      wants: list(
        obj({
          role: text,
          kinds: list(obj({ kind: text, per: oneOf('sleeper', 'room') })),
        }),
      ),
    }),
    // P3.4: furniture is made at a bench by the `job`, of `material`, one piece for `cost`, in
    // `minutes` at crafting 0 (shorter at `skilled` over (`skilled` + level)); its quality is the
    // maker's crafting level plus a `roll` from the `stream`, worded by the first `quality` it
    // reaches. P3.6: a kind's own `job` and `material` (a hearth), then `also` (a well).
    furniture: obj({
      job: ref('jobs'),
      skilled: num({ min: 1 }),
      material: ref('items'),
      stream: text,
      roll: count,
      kinds: list(
        obj({
          id,
          name: text,
          cost: num({ min: 1 }),
          minutes: num({ min: 1 }),
          art: text,
          beds: count,
          seats: count,
          place: oneOf('wall', 'middle', 'beside table', 'bed foot', 'centre'),
          job: opt(ref('jobs')),
          material: opt(ref('items')),
          also: opt(obj({ material: ref('items'), cost: num({ min: 1 }) })),
        }),
      ),
      quality: list(obj({ id, word: text, at: num(), beauty: num() })),
    }),
  }),
};
