// Shape of Vulcan's self file (src/content/data/self.json, P6.4, V-146, V-156): the roles a person
// can see themself in, what makes each, and the life ambitions some hold.
import { list, map, num, obj, oneOf, opt, ref, str } from './schema';
import { count, id, text } from './schema-fields';

export const SELF_SCHEMAS = {
  self: obj({
    // A role is held from `at` points, at most `most` of them; a held role gives way only to one
    // `keep` points stronger. Each `skillStep` levels of the best listed skill is a point; only a
    // heavy or lasting memory counts. Roles are worked out daily at `hour`.
    at: num({ min: 1 }),
    most: num({ min: 1 }),
    keep: count,
    skillStep: num({ min: 1 }),
    hour: num({ min: 0, max: 23 }),
    roles: list(
      obj({
        id,
        name: text,
        traits: map(num(), 'traits'),
        memories: map(num(), 'memories'),
        skills: opt(list(str())),
        beliefs: opt(map(num())),
        // Points for having come as a newcomer, and for refusing a law now.
        newcomer: opt(num()),
        refused: opt(num()),
      }),
    ),
    // Every `checkDays` someone with none takes up one that fits at `chance` per cent; those who
    // practise do so a minute in every `every` of their free time; done, they gain `memory`.
    ambition: obj({
      checkDays: num({ min: 1 }),
      chance: num({ min: 0, max: 100 }),
      every: num({ min: 1 }),
      memory: ref('memories'),
    }),
    // `master`: best of `skills` at `from` or more, with potential for `to`, done at `to`;
    // `learn`: a skill of `skills` with potential `from` or more and level under `under`, done at `to`;
    // `house`: no house of their own yet, done when one stands.
    ambitions: list(
      obj({
        id,
        text,
        kind: oneOf('master', 'learn', 'house'),
        skills: opt(list(str())),
        from: opt(count),
        under: opt(count),
        to: opt(count),
      }),
    ),
  }),
};
