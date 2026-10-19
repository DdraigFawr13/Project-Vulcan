// Shapes of the world, magic-tier, creature and item files in src/content/data.
import { any, bool, list, map, num, obj, oneOf, opt, range, ref, str } from './schema';
import { attribute, count, id, share, text, texts } from './schema-fields';

export const WORLD_SCHEMAS = {
  calendar: obj({
    daysPerWeek: count,
    daysPerMonth: count,
    monthsPerYear: count,
    seasons: list(str()),
    monthNames: list(str()),
  }),
  tiers: list(
    obj({
      id: oneOf('none', 'faint', 'gifted', 'strong', 'exceptional', 'legendary'),
      minPower: count,
      maxPower: count,
      soldiers: range(),
      caps: obj({ maxDamage: count, maxAreaRadius: count, maxUsesPerDay: count }),
    }),
  ),
  biomes: obj({
    biomes: list(
      obj({
        id,
        name: text,
        color: list(num({ min: 0, max: 255 }), 3),
        fertility: count,
        wildness: count,
        travel: count,
        water: opt(oneOf('sea', 'coast', 'lake')),
        forest: opt(bool()),
      }),
    ),
    rules: obj({
      temperatureBands: list(num()),
      rainfallBands: list(num()),
      table: list(list(ref('biomes'))),
      alpineElevation: num(),
      frostFree: obj({
        biomes: list(ref('biomes')),
        minWinter: num(),
        fallback: map(ref('biomes'), 'biomes'),
      }),
      swampRainfall: num(),
      swampMinTemp: num(),
      coastReach: count,
    }),
  }),
  resources: list(
    obj({
      id,
      name: text,
      category: str(),
      good: opt(str()),
      minElevation: opt(num()),
      maxElevation: opt(num()),
      clustersPer10k: count,
      clusterSize: count,
      maxCellShare: share,
      needs: opt(map(any())),
      biomes: opt(list(ref('biomes'))),
      aquatic: opt(bool()),
    }),
  ),
  weather: list(
    obj({
      id,
      name: text,
      warmth: num(),
      seasonWeights: obj({ spring: count, summer: count, autumn: count, winter: count }),
    }),
  ),
  'great-works': obj({
    kinds: list(
      obj({
        id,
        word: text,
        thing: opt(bool()),
        names: texts,
        siteKinds: texts,
        features: texts,
        builder: obj({
          minPower: count,
          schools: list(ref('schools')),
          raceIds: list(ref('races')),
        }),
        cost: map(count),
      }),
    ),
    legendOrder: map(texts),
    realmOrder: texts,
    legendChance: share,
    realmChance: share,
    realmWealthMin: count,
    realmGapYears: count,
    maxPerSite: count,
    years: range(),
    epithets: texts,
    wallDefence: num(),
    wallRaidShare: share,
    bridgeWealth: num(),
    groveHarvest: num(),
    grovePlague: num(),
    towerKeepPower: count,
    fallPhrases: map(text),
    fallCauses: texts,
    enchant: any(),
  }),
  creatures: list(
    obj({
      id,
      name: text,
      tier: oneOf('beast', 'great', 'legendary'),
      biomes: list(ref('biomes')),
      minWildness: count,
      danger: count,
      maxAlive: count,
      spawnChance: share,
      lifespan: range(),
      raidChance: share,
      raidRange: count,
      roam: opt(count),
      names: texts,
    }),
  ),
  dragons: obj({
    creatureId: ref('creatures'),
    names: texts,
    tempers: list(any()),
    lairNames: texts,
    court: any(),
    // The other dragon fields are Story Generator history tuning, kept as forked.
    firstBy: num(),
    laterFirstBy: num(),
    cellsPerDragon: num(),
    maxAlive: num(),
    lairsApart: num(),
    lairRegionReach: num(),
    noSettleRadius: num(),
    tributeShare: num(),
    seekerPerHoard: num(),
    seekerMax: num(),
    seekerRange: num(),
    treasureValue: num(),
    grainPerSpoil: num(),
    slainImportance: num(),
    successorGap: range(),
    ageOnWaking: range(),
    lairRegionKinds: texts,
    lairUnder: text,
    lairNear: text,
    tributeWord: text,
    tributeAgain: text,
    hoardWords: map(texts),
    spoilsWord: text,
  }),
  items: list(
    obj({
      id,
      name: text,
      good: str(),
      per: count,
      kind: str(),
      spoilPerMonth: opt(share),
      spoilPerDay: opt(share),
      cooked: opt(bool()),
      forms: opt(texts),
      effects: opt(
        list(
          obj({
            kind: oneOf('combat', 'attribute', 'power'),
            value: opt(num()),
            attribute: opt(attribute),
            bonus: opt(num()),
          }),
        ),
      ),
      downsides: opt(texts),
    }),
  ),
  // Vulcan's own, not forked: the ledger text of every event type the engine may emit.
  // Slots are {actorN}, {subjectN} and data keys; the engine refuses an event that leaves one empty.
  // `notable` (P2.6, P2.7) makes a line an alert and a stop for skip ahead: `{}` always, or data
  // values a line must have, alternatives split by `|` (a mood only when it fell low).
  events: list(
    obj({ id, importance: num({ min: 1, max: 3 }), template: text, notable: opt(map(str())) }),
  ),
  // Vulcan's own: the ground kinds a map tile can be, and the surface map's size and starting
  // ground. `art` names a frame family in the art sheets; `variants` frames end in .1, .2, ...
  terrain: obj({
    surface: obj({ width: count, height: count, ground: ref('terrain') }),
    // The surface generator's dials (src/engine/map/terrain.ts): ranges are [min, max] drawn once
    // per seed; shares are of the map's tiles; elevations are metres, temperatures degrees C.
    generator: obj({
      climates: list(
        obj({ id, name: text, weight: count, temperature: range(), rainfall: range() }),
      ),
      elevation: obj({ floor: range(), relief: range(), lapse: count, axisNoise: share }),
      noise: obj({ cell: num({ min: 2 }), octaves: num({ min: 1, max: 8 }) }),
      moisture: obj({ cell: num({ min: 2 }), low: count, span: count }),
      ridges: obj({ cell: num({ min: 2 }), weight: count }),
      rocks: list(obj({ kind: ref('terrain'), weight: count })),
      layout: str(),
      layouts: map(
        obj({
          count: range(),
          radius: range(),
          height: range(),
          rimShare: share,
          rim: range(),
          inside: share,
          align: share,
          rough: range(),
          stretch: range(),
          warp: count,
          warpCell: num({ min: 2 }),
        }),
      ),
      rock: obj({
        screeKind: ref('terrain'),
        snowArt: str(),
        snowline: num(),
        snowTop: share,
        line: count,
        wall: range(),
        scree: share,
        outcrops: share,
        outcropCell: num({ min: 2 }),
      }),
      valleyFloor: share,
      alpine: ref('biomes'),
      swamp: ref('biomes'),
      swampLowland: share,
      lowlandRain: count,
      groves: obj({
        cell: num({ min: 2 }),
        low: count,
        high: count,
        oldGrowth: obj({ cell: num({ min: 2 }), share, factor: count }),
        glades: obj({ share, factor: count }),
      }),
      // Rivers, streams, lakes and springs (src/engine/map/water.ts). Flows are in tiles of rain
      // gathered, scaled by the valley's rainfall over `flowRain`; depths and heights are metres.
      water: obj({
        tilt: count,
        jitter: count,
        meander: count,
        meanderCell: num({ min: 2 }),
        mountainFoot: count,
        mountainRain: count,
        floorRain: count,
        flowRain: num({ min: 1 }),
        streamFlow: num({ min: 1 }),
        riverFlow: num({ min: 1 }),
        widenFlow: num({ min: 1 }),
        wideFlow: num({ min: 1 }),
        wideReach: num({ min: 1 }),
        swellMin: count,
        swellSpan: count,
        widthCell: num({ min: 2 }),
        lakeDepth: count,
        lakeArea: num({ min: 1 }),
        basinDepth: count,
        lakeGrow: count,
        deepDepth: count,
        bankCell: num({ min: 2 }),
        marshWet: share,
        marshBank: share,
        beachBank: share,
        hills: count,
        shallow: ref('terrain'),
        deep: ref('terrain'),
        spring: ref('terrain'),
        beach: ref('terrain'),
        marsh: ref('terrain'),
      }),
      start: obj({
        woodItem: ref('items'),
        stoneItem: ref('items'),
        radius: count,
        buildable: num({ min: 1 }),
        wood: num({ min: 1 }),
        stone: num({ min: 1 }),
        // The green (src/engine/map/green.ts): its own ground is `near` tiles round it; `rise`
        // metres a step and water `water` tiles off each cost a whole dry share; `spare` weighs
        // wood and stone past the need; `edge` keeps it off the map's rim; `apart` tiles
        // separate the band's second choice from its first.
        green: obj({
          near: count,
          rise: num({ min: 0.01 }),
          water: num({ min: 1 }),
          spare: num({ min: 0 }),
          edge: count,
          apart: count,
        }),
      }),
      // The four levels below (src/engine/map/underground.ts), each made when first reached:
      // each range's rock runs down beneath it within `roots` tiles (more per level down), the
      // rest is bedrock bodies; level 1 is earth under the valley floor; caves are tunnels and
      // caverns, as shares of each level by depth (index 0 is level 1). Veins are in features.
      // Aura spots (src/engine/map/aura.ts): a faint background up to `base`, and strong spots
      // fading by `falloff` a ring out to `radius`; each site kind (code) gives its school here.
      aura: obj({
        base: count,
        cell: num({ min: 2 }),
        strength: range(),
        radius: count,
        falloff: count,
        count: range(),
        spacing: count,
        margin: count,
        peakShare: share,
        wood: obj({ reach: count, trees: count }),
        lake: count,
        cavern: obj({ reach: count, open: count }),
        deepLevel: count,
        sites: list(
          obj({
            site: oneOf('peak', 'spring', 'wood', 'lake', 'cavern', 'obsidian'),
            school: ref('schools'),
            words: text,
            deep: opt(bool()),
          }),
        ),
      }),
      underground: obj({
        depth: num({ min: 1, max: 8 }),
        roots: obj({ reach: count, perLevel: count, warp: count, fine: count }),
        warpCell: num({ min: 2 }),
        bodies: obj({
          count: range(),
          bend: count,
          bendCell: num({ min: 2 }),
          fine: count,
          fineCell: num({ min: 2 }),
        }),
        earth: obj({
          soil: ref('terrain'),
          clay: ref('terrain'),
          groundwater: ref('terrain'),
          foot: count,
          footNoise: count,
          soilCell: num({ min: 2 }),
          clayReach: count,
          clayShare: share,
          wetShare: share,
        }),
        caves: obj({
          kind: ref('terrain'),
          tunnels: list(share),
          caverns: list(share),
          length: range(),
          turn: share,
          swing: share,
          wide: share,
          cavernCell: num({ min: 2 }),
        }),
        // The most tiles one opening shows at once (V-030 fog).
        reveal: num({ min: 1 }),
        stairsDown: ref('terrain'),
        stairsUp: ref('terrain'),
        stairs: ref('terrain'),
        shaft: ref('terrain'),
      }),
    }),
    // The ground kind each biome's land shows.
    floors: map(ref('terrain'), 'biomes'),
    kinds: list(
      obj({
        id,
        name: text,
        art: str(),
        variants: num({ min: 1 }),
        buildable: opt(bool()),
        stone: opt(bool()),
        digs: opt(obj({ item: ref('items'), count: num({ min: 1 }) })), // what digging it gives
        // Water can be waded (shallow) or not crossed (deep); `marker` names a picture in the
        // nature sheet drawn over the tile, such as a spring's.
        water: opt(oneOf('shallow', 'deep')),
        drinkable: opt(bool()),
        marker: opt(str()),
        // Earth and clay underground: walls until dug, like rock, but not stone.
        solid: opt(bool()),
        // P2.3: walking cost per tile, 1 when left out; stone, solid ground and deep water are
        // never walked.
        walk: opt(num({ min: 1 })),
      }),
    ),
    // P2.3: stride per tick and step costs, in tenths of a straight step (src/engine/paths).
    walking: obj({
      speed: num({ min: 1 }),
      straight: num({ min: 1 }),
      diagonal: num({ min: 1 }),
      stairs: num({ min: 1 }),
      shaft: num({ min: 1 }),
      ice: num({ min: 1 }),
    }),
  }),
};
