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
      look: num({ min: 1 }),
    }),
    // What each temper (the package's ids) adds to the weight of the news's memory.
    tempers: map(count),
    // The memory of the news, and the bitter one for anyone not of the lord's people.
    memories: obj({ named: ref('memories'), bitter: ref('memories') }),
    // 6C Slice 2 (V-222): the tithe. The Lord law's id; the share in 100 of what is brought in
    // (tempers raising it); the item kinds tithed; the Build sheet's Tithe barn row (its name,
    // start level and house size); a lean year (under `days` days' eating in store at the visit), the tempers that take half, the memory each
    // grown-up keeps and the standing cause; one visit in `search` the reeve searches the houses.
    tithe: obj({
      law: str(),
      rate: num({ min: 1, max: 100 }),
      tempers: map(num({ min: 1, max: 100 })),
      kinds: list(ref('items')),
      barn: obj({ name: text, start: num({ min: 1, max: 4 }), size: str() }),
      lean: obj({
        days: num({ min: 1 }),
        half: list(str()),
        memory: ref('memories'),
        standing: obj({ by: num(), days: num({ min: 1 }), text }),
      }),
      search: num({ min: 1 }),
    }),
    // Favour (V-222): 0 to 100 from `start`, made of causes that each count for `days`, as
    // standing is; the causes' worth and words ({...} filled from the visit); the ladder's steps,
    // each taken once when favour falls to `below` or rises to `above`, adding `by` in 100 to the
    // share; the lord's men (V-211): the wounds they give and the line's words.
    favour: obj({
      start: num({ min: 0, max: 100 }),
      days: num({ min: 1 }),
      causes: map(obj({ by: num(), text })),
      ladder: list(
        obj({
          id: str(),
          below: opt(num({ min: 0, max: 100 })),
          above: opt(num({ min: 0, max: 100 })),
          text,
          by: num(),
        }),
      ),
      men: obj({ kinds: list(str()), parts: list(str()), severity: str(), what: text }),
    }),
    // The lord's forest: the find of kind `place` farthest from the green, and every tile within
    // `reach` of it.
    forest: obj({ place: str(), reach: num({ min: 1 }) }),
    // 6C Slice 7 part 4 (V-236, V-242): the `charter` ladder step needs `least` living and more
    // than `years` years settled; everyone living then keeps `memory`.
    charter: obj({ least: count, years: num({ min: 0 }), memory: ref('memories') }),
    // 6C Slice 7 part 2 (V-236, V-240): the lord comes himself every `every`th harvest home with
    // `men` of his men, for the supper. `table` by Feasts law setting: the portions over one each
    // laid for every eater (his party eats one more) and cups of ale each where a cask is ready;
    // favour cause `table-<setting>`. `pleases` by temper: what he looks for (contest, table,
    // rite, book, store) and the words when it is there or not (causes `pleased`, `displeased`).
    // `hothead`: in 100 per point of grievance (`reasons`), at most `most`, one may speak out
    // (`says`, drawn; each grievance's words `why`, in the order checked); everyone there keeps `memory`; a `beat` lord has them beaten. `petition`:
    // in a lean year, at most once in `every` years; the tempers that forgive the tithe whole, those
    // that halve it from `favour`, the rest refuse (cause `plea`); the memories of the answer.
    visit: obj({
      every: num({ min: 1 }),
      men: num({ min: 0 }),
      prize: obj({ material: str(), quality: str() }),
      table: map(obj({ extra: num({ min: 0 }), ale: num({ min: 0 }) })),
      pleases: map(obj({ wants: str(), yes: text, no: text })),
      hothead: obj({
        odds: num({ min: 0, max: 100 }),
        most: num({ min: 0, max: 100 }),
        reasons: map(obj({ points: num({ min: 0 }), why: text })),
        says: list(text),
        memory: ref('memories'),
        beat: list(str()),
      }),
      petition: obj({
        every: num({ min: 1 }),
        whole: list(str()),
        half: obj({ tempers: list(str()), favour: num({ min: 0, max: 100 }) }),
        answers: obj({ whole: text, half: text, no: text }),
        memories: obj({ heard: ref('memories'), refused: ref('memories') }),
      }),
    }),
  }),
};
