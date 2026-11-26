// Shape of Vulcan's contests file (src/content/data/contests.json, 6C Slice 7 part 3, V-236,
// V-241): the contests held at each harvest home, who stands up for them, and what a win leaves.
import { list, map, num, obj, oneOf, opt, ref, str } from './schema';
import { attribute, count, text, texts } from './schema-fields';

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
    // Contests won in all that give a byname; times runner-up to the same winner that make rivals.
    wins: num({ min: 1 }),
    beaten: num({ min: 1 }),
    memories: obj({ won: ref('memories'), lost: ref('memories'), rival: ref('memories') }),
    // Each contest: what the valley must do for it (`none`, `field`: a field laid out, `brewer`:
    // a cask brewed; a new need is engine code, hold.ts `canHold`), the skill (at least `least`) and attribute it is won by, the winner's words,
    // the byname (`m` for a man where it differs) and spares, each also in tales.json `byname.proud`,
    // and the lord's prize (a tools.json kind).
    kinds: list(
      obj({
        id: str(),
        name: text,
        needs: oneOf('none', 'field', 'brewer'),
        skill: opt(ref('abilities')),
        least: opt(count),
        attribute,
        won: text,
        byname: text,
        m: opt(text),
        spares: texts,
        prize: str(),
      }),
    ),
  }),
};
