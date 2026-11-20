// Shape of Vulcan's tavern file (src/content/data/tavern.json, 6B Bundle 5, P6.12, V-188): the
// tavern the colony builds, how ale is brewed, who goes of an evening and what ale does to them.
import { list, map, num, obj, ref, str } from './schema';
import { count, text, texts } from './schema-fields';

const percent = num({ min: 0, max: 100 });

export const TAVERN_SCHEMAS = {
  tavern: obj({
    // The Build sheet's Tavern row (`start` level), the house size it is (buildings.house.sizes),
    // the names it may take and what it wants inside: furniture kinds and how many of each.
    build: obj({
      name: text,
      start: num({ min: 1 }),
      size: str(),
      names: texts,
      wants: list(obj({ kind: str(), count: num({ min: 1 }) })),
    }),
    // Brewing: the jobs.json job, the brewing tub and cask furniture kinds, minutes a brew takes at
    // skill `skilled`, cups a cask holds and days before it is ready; recipes in order, each `count`
    // of one of `from` (items) brewed into `drink`.
    brew: obj({
      job: ref('jobs'),
      tub: str(),
      cask: str(),
      minutes: count,
      skilled: num({ min: 1 }),
      cups: num({ min: 1 }),
      days: num({ min: 1 }),
      recipes: list(obj({ drink: text, from: list(ref('items')), count: num({ min: 1 }) })),
    }),
    // The work.json Stock row ale is brewed toward (cups in casks).
    stock: str(),
    // Of an evening: per cent going (plus each trait's), cups at most (`lowCups` for someone whose
    // mood is under `low`), minutes before leaving with no ale or no innkeeper, the cup's memory.
    evening: obj({
      go: percent,
      traits: map(num(), 'traits'),
      cups: num({ min: 1 }),
      low: count,
      lowCups: num({ min: 1 }),
      leave: num({ min: 1 }),
      cup: ref('memories'),
    }),
    // The innkeeper: the jobs.json job, the trait that breaks ties, new tales a day they hear.
    keeper: obj({ job: ref('jobs'), trait: ref('traits'), hears: num({ min: 1 }) }),
    // Per cent more a telling bends after a cup.
    bend: percent,
    // After a second cup a `trait` drinker comes to blows at `chance` per cent an evening: light
    // wounds of `kinds` to `parts`, the memory both keep.
    brawl: obj({
      chance: percent,
      trait: ref('traits'),
      kinds: texts,
      parts: texts,
      what: text,
      memory: ref('memories'),
    }),
    // More than `after` cups: the morning's memory, and a minute in `idle` lost at work until `until` o'clock.
    hungOver: obj({
      after: num({ min: 1 }),
      memory: ref('memories'),
      idle: num({ min: 2 }),
      until: num({ min: 0, max: 23 }),
    }),
  }),
};
