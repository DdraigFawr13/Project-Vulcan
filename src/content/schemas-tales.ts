// Shape of Vulcan's tales file (src/content/data/tales.json, P6.3, V-140, V-155, V-162): which
// ledger events become tales, the words of each at every telling's level, how tales pass and bend,
// the beliefs they leave and the winter evening by the hearth.
import { bool, list, map, num, obj, oneOf, opt, str } from './schema';
import { count, id, text } from './schema-fields';

const percent = num({ min: 0, max: 100 });

export const TALES_SCHEMAS = {
  tales: obj({
    // Per cent a pair passes a tale each hour: eating together, at leisure together, side by side
    // at work, or by a lit hearth on a winter evening; a person hears at most `perDay` new tales a day.
    pass: obj({
      meal: percent,
      leisure: percent,
      work: percent,
      hearth: percent,
      tavern: percent,
      perDay: num({ min: 1 }),
    }),
    // The words each place adds to the line: "Cai told Dilys by the fire: …".
    places: obj({ meal: str(), leisure: str(), work: str(), hearth: str(), tavern: str() }),
    // Per cent a telling bends the tale one level, plus each teller trait's own; `softer` per
    // cent of the bends tone it down instead of up.
    bend: obj({ chance: percent, traits: map(num(), 'traits'), softer: percent }),
    // A belief not fed for this many days drops a step.
    beliefFadeDays: num({ min: 1 }),
    // A tale nobody has told or heard again for this many days is forgotten.
    forgetDays: num({ min: 1 }),
    // The words for strength 1 to 4: doubting to certain.
    strength: list(str(), 4),
    // Ordinal words for the colony's years in song titles.
    ordinals: list(str()),
    // By the hearth on a winter evening, each worn garment is mended this much an hour.
    evening: obj({ mend: count }),
    // A byname comes once a tale about someone is held by over `share` per cent of the grown-ups
    // and told `told` times; the `proud` bynames please, the rest sting.
    byname: obj({ share: percent, told: num({ min: 1 }), proud: list(str()) }),
    beliefs: list(obj({ id, about: oneOf('person', 'place', 'law', 'colony'), text })),
    // `event`: the ledger type it copies; `levels`: its words from mildest to worst, filled from the
    // event's data; `truth`: the level of what happened; `belief` forms in whoever holds it at
    // level `from` or worse; `word`: no one sees it, and one awake person brings word of it; `only`: the
    // event's data must hold these values (a serious hurt).
    tales: list(
      obj({
        id,
        event: str(),
        only: opt(map(str())),
        truth: count,
        belief: str(),
        from: count,
        word: opt(bool()),
        // Title templates for a song made of it (a big event); one is chosen by the seed.
        song: opt(list(str())),
        // The byname each level gives the one it is about ("" for none).
        bynames: opt(list(str())),
        levels: list(text),
      }),
    ),
  }),
};
