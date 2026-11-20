// Shape of Vulcan's worship file (src/content/data/worship.json, 6B Bundle 4, P6.8, V-143,
// V-187): how devout each person is, where the faithful raise a shrine, how often they pray, how a
// faith leans law answers, and the feast days asked for from the colony's own history.
import { bool, list, map, num, obj, oneOf, opt, ref, str } from './schema';
import { count, text } from './schema-fields';

export const WORSHIP_SCHEMAS = {
  worship: obj({
    // Devotion 0 to 10: the home people's `faith` value, a seeded nudge of up to `spread` either
    // way, and `devout` more for the `trait`; shown as the first word whose `from` it reaches.
    devotion: obj({
      spread: count,
      trait: ref('traits'),
      devout: count,
      words: list(obj({ from: count, word: text })),
    }),
    // The shrine (a builders' furniture kind) of a faith: its `faiths` entry, else `kind`; `water`
    // sites it by water if the green has some. Sited within `near` tiles of the first hearth once
    // `least` living people hold the faith.
    shrine: obj({
      kind: str(),
      faiths: map(obj({ kind: str(), water: opt(bool()) }), 'faiths'),
      near: num({ min: 1 }),
      least: num({ min: 1 }),
    }),
    // Prayer in free time: `minutes` at their shrine for `memory`, at most once in `days` for the
    // first `from` their devotion reaches (none under the last).
    pray: obj({
      minutes: num({ min: 1 }),
      memory: ref('memories'),
      every: list(obj({ from: count, days: num({ min: 1 }) })),
    }),
    // A follower at devotion 10 leans this much towards a law setting that serves what their
    // faith holds sacred (against one that harms it; the reverse for what it abhors).
    lean: count,
    // A death is a feast day when at least this per cent of the living grieved it closely.
    grieved: num({ min: 0, max: 100 }),
    // On a feast day work stops at `noon`; under `leanDays` days of food it is kept lean, with the
    // `lean` memory and no supper.
    feast: obj({ noon: num({ min: 1, max: 23 }), leanDays: count, lean: ref('memories') }),
    // Why a shrine rises, by the reason the colony first gathered ({about}, {other}, {names}).
    why: obj({ death: text, wedding: text, harvest: text, shared: text }),
    // The feast days the priest asks for: their name, what is kept, the why on the Laws sheet,
    // and the memories of the feast, the rite and (a death) remembering.
    days: list(
      obj({
        kind: oneOf('arrival', 'death', 'wedding'),
        name: text,
        what: text,
        why: text,
        feast: ref('memories'),
        rite: ref('memories'),
        remember: opt(ref('memories')),
      }),
    ),
  }),
};
