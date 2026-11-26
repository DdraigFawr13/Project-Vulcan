// Shape of Vulcan's contests file (src/content/data/contests.json, 6C Slice 7 part 3, V-236,
// V-241): the contests held at each harvest home, who stands up for them, and what a win leaves.
import { list, map, num, obj, opt, ref, str } from './schema';
import { count, text, texts } from './schema-fields';

export const CONTESTS_SCHEMAS = {
  contests: obj({
    // Contests a harvest home (`each`), and with the lord at the supper (`lord`); fewer than
    // `least` standing up and a contest is not held.
    each: num({ min: 0 }),
    lord: num({ min: 0 }),
    least: num({ min: 2 }),
    // Who stands up, in 100: `base`, each trait's push, `rival` while one's rival stands, `won`
    // for one who has won that contest before.
    enter: obj({ base: num(), traits: map(num(), 'traits'), rival: num(), won: num() }),
    // A contestant's score: skill level plus attribute plus a roll of 0 to `roll`.
    roll: count,
    // Wins of one contest that give its byname; times beaten by the same winner that make rivals.
    wins: num({ min: 1 }),
    beaten: num({ min: 1 }),
    memories: obj({ won: ref('memories'), lost: ref('memories'), rival: ref('memories') }),
    // Each contest: what the valley must do for it (`none`, `field`: a field laid out, `brewer`:
    // a cask brewed), the skill (at least `least`) and attribute it is won by, the winner's words,
    // the byname (`m` for a man where it differs) and spares, and the lord's prize (a tool kind).
    kinds: list(
      obj({
        id: str(),
        name: text,
        needs: str(),
        skill: opt(ref('abilities')),
        least: opt(count),
        attribute: str(),
        won: text,
        byname: text,
        m: opt(text),
        spares: texts,
        prize: str(),
      }),
    ),
  }),
};
