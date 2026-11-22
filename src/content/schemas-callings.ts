// Shape of Vulcan's callings file (src/content/data/callings.json, 6B Bundle 6, P6.13, V-175, V-189
// q8 and q9): rare roles with a high bar, at most one holder each, and what each pushes.
import { bool, list, map, num, obj, oneOf, opt, ref, str } from './schema';
import { attribute, count, id, text } from './schema-fields';

const percent = num({ min: 1 });

// One test of a bar; `word` says it in the calling's line ({n} the measure, {of}, {skill}).
const testFields = {
  test: oneOf(
    'trait',
    'trusted',
    'friends',
    'tales',
    'lines',
    'attribute',
    'ambition',
    'skill',
    'memory',
    'role',
    'either',
  ),
  word: text,
  any: opt(list(ref('traits'))),
  none: opt(list(ref('traits'))),
  top: opt(num({ min: 1 })),
  share: opt(num({ min: 1, max: 100 })),
  from: opt(count),
  event: opt(str()),
  actor: opt(count),
  attr: opt(attribute),
  id: opt(str()),
  skills: opt(list(ref('abilities'))),
};
const test = obj({ ...testFields, or: opt(list(obj(testFields))) });

export const CALLINGS_SCHEMAS = {
  callings: obj({
    // Every `every` days at `hour` each calling with no living holder goes to the best who passes
    // its first stage's bar (by the measure of test `best`). Friends are colony `talkersOf`: told or heard a tale lately's.
    every: num({ min: 1 }),
    hour: num({ min: 0, max: 23 }),
    callings: list(
      obj({
        id,
        name: text,
        titles: opt(map(text, 'abilities')),
        // Stages (6E reuses the frame); only the first is read now.
        stages: list(obj({ id, bar: list(test), sign: text })),
        best: count,
        push: obj({
          cool: opt(num({ min: 1 })),
          told: opt(num({ min: 1 })),
          keep: opt(percent),
          apprentice: opt(percent),
          masterwork: opt(
            obj({
              events: map(ref('abilities')),
              names: list(text),
              quality: str(),
              pieces: map(text, 'abilities'),
            }),
          ),
          watch: opt(bool()),
          fade: opt(obj({ belief: str(), by: percent })),
        }),
      }),
    ),
  }),
};
