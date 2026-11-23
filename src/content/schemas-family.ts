// Shape of Vulcan's family file (src/content/data/family.json, P6.1, V-145, V-161): how closeness
// grows between two unwed adults, when they court and when they wed.
import { list, map, num, obj, oneOf, opt, ref } from './schema';
import { count, text, texts } from './schema-fields';

export const FAMILY_SCHEMAS = {
  family: obj({
    // The hour of the day closeness fades and courtships move on.
    hour: num({ min: 0, max: 23 }),
    // What two people do together for an hour to grow closer: `doing` values.
    leisure: texts,
    near: num({ min: 1 }),
    // An hour together gives `base`, + `shared` for each trait they share, − `clash` for each
    // trait of one the other's excludes (traits.json), never under 0.
    like: obj({ base: count, shared: count, clash: count }),
    // Each tale one told the other that day.
    told: count,
    // Closeness lost each day, per cent.
    fade: num({ min: 0, max: 100 }),
    // At `from` closeness two court; after `days` days courting they wed, unless closeness fell
    // to `part`. Two court only when each is drawn to the other (`orientations`). One widowed
    // mourns `mourn` days from the death before courting again (V-214).
    court: obj({ from: num({ min: 1 }), days: num({ min: 1 }), part: count, mourn: count }),
    // Whom a person is drawn to, one drawn per person by `weight` (per thousand, after the
    // Gallup 2025 US shares): the `other` sex, the `same`, `both` or `none`. `woman`: her word.
    orientations: list(
      obj({
        id: text,
        name: text,
        woman: opt(text),
        drawn: oneOf('other', 'same', 'both', 'none'),
        weight: count,
        description: text,
      }),
    ),
    // A wedding feast only while the store holds `feastDays` days of food for everyone.
    feastDays: count,
    // Words for the courting and wedding lines; {whose} is filled with the home's owner (`empty`,
    // `unplanned`: the home of the other one given up, built or planned).
    words: obj({
      ...{ together: text, alike: text, tales: text, want: text, live: text, empty: text },
      unplanned: text,
      ...{ girl: text, boy: text, like: text, mother: text, father: text },
      ...{ daughter: text, son: text, orphan: text, leftHere: text },
    }),
    // Births (part 2): a wed woman's chance each day, per thousand, times her race's fertility,
    // from her race's coming of age to `until` per cent of its lifespan; `carryDays` carried, at
    // least `restDays` since her last child; none while the store holds under `leanDays` days of
    // food or she holds the `hungry` memory.
    birth: obj({
      perMille: num({ min: 0, max: 1000 }),
      until: num({ min: 0, max: 100 }),
      carryDays: num({ min: 1 }),
      restDays: count,
      leanDays: count,
      hungry: ref('memories'),
    }),
    // A child works from `helpFrom` per cent of their race's coming of age, only at `jobs`.
    child: obj({ helpFrom: num({ min: 0, max: 100 }), jobs: texts }),
    // A parent's attribute `by` or more above (below) the race's mean passes at `gift` (`weakness`)
    // per cent; parents who share a parent add `kin` to the weakness odds.
    inherit: obj({ by: num({ min: 1 }), gift: count, weakness: count, kin: count }),
    gifts: map(text),
    weaknesses: map(text),
    // Old age: from `from` per cent of the lifespan, `per` in 100,000 a day for each year past
    // it; `cause` the death line's words ({them}: him or her).
    // A stranger who came for one of `kinds` may leave a child aged within `ages`, `percent` of
    // the time, weighed once while they wait at the green.
    left: obj({ percent: num({ min: 0, max: 100 }), kinds: texts, ages: list(num({ min: 0 }), 2) }),
    old: obj({ from: num({ min: 0, max: 100 }), per: count, cause: text }),
    memories: obj({
      wed: ref('memories'),
      feast: ref('memories'),
      born: ref('memories'),
      grown: ref('memories'),
      spouse: ref('memories'),
      child: ref('memories'),
      parent: ref('memories'),
      taken: ref('memories'),
    }),
  }),
};
