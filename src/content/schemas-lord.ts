// Shape of Vulcan's lord file (src/content/data/lord.json, 6C Slice 1, V-216): what the colony
// calls its lord by the realm's kind, the reeve's day, what each temper adds to the news's weight
// and the memories the news leaves.
import { list, map, num, obj, opt, ref, str } from './schema';
import { count, text } from './schema-fields';

const hour = num({ min: 0, max: 23 });
const title = obj({ title: text, f: opt(text) });

export const LORD_SCHEMAS = {
  lord: obj({
    // A title for each word a realm's name gives its kind ("Jarldom" of "Jarldom of Brandby");
    // `f` for a woman where it differs. `title` for a kind not listed.
    titles: list(obj({ kind: str(), title: text, f: opt(text) })),
    title,
    // The reeve: his sex (for his name), his pace (he rides: steps a minute as a walker takes one), the hour he comes up the road the morning after a harvest
    // home, the hour by which he speaks to whoever is nearest if he has not reached the elder, the
    // hour he is gone by, how near (tiles) he speaks from, and every how many minutes he looks again
    // for the one he seeks.
    reeve: obj({
      sex: str(),
      pace: num({ min: 1 }),
      arrive: hour,
      speakBy: hour,
      leave: hour,
      reach: num({ min: 1 }),
      seek: num({ min: 1 }),
    }),
    // What each temper (the package's ids) adds to the weight of the news's memory.
    tempers: map(count),
    // The memory of the news, and the bitter one for anyone not of the lord's people.
    memories: obj({ named: ref('memories'), bitter: ref('memories') }),
  }),
};
