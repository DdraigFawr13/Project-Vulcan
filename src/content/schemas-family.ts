// Shape of Vulcan's family file (src/content/data/family.json, P6.1, V-145, V-161): how closeness
// grows between two unwed adults, when they court and when they wed.
import { bool, num, obj, ref } from './schema';
import { count, texts } from './schema-fields';

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
    // to `part`. `anySex`: any two may court, else a woman and a man.
    court: obj({ from: num({ min: 1 }), days: num({ min: 1 }), part: count, anySex: bool() }),
    // A wedding feast only while the store holds `feastDays` days of food for everyone.
    feastDays: count,
    memories: obj({ wed: ref('memories'), feast: ref('memories') }),
  }),
};
