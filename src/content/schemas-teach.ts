// Shape of Vulcan's teaching file (src/content/data/teach.json, 6B Bundle 6, P6.13, V-074, V-141,
// V-189): learning beside a master, apprentices, children watching a parent, and a master's loss.
import { list, map, num, obj } from './schema';
import { count, text } from './schema-fields';

const percent = num({ min: 0 });

export const TEACH_SCHEMAS = {
  teach: obj({
    // A master is someone at `master` or more who is `ahead` levels or more ahead of the learner,
    // working at the same skill within `reach` tiles (their own apprentice within `bondReach`).
    master: num({ min: 1 }),
    ahead: num({ min: 1 }),
    reach: num({ min: 1 }),
    bondReach: num({ min: 1 }),
    // Practice per minute in per cent of practice alone: beside a master, beside one's own master.
    beside: percent,
    apprentice: percent,
    // Taught, a learner may rise `past` levels beyond their potential, never above the teacher
    // less 1. Alone, a level from `slow.from` up takes `slow.times` as long.
    past: count,
    slow: obj({ from: num({ min: 1 }), times: num({ min: 1 }) }),
    // Each trait's per cent more (or less) on every minute of practice; never under `least`.
    traits: map(num(), 'traits'),
    least: num({ min: 1 }),
    // The hour of the day masters take and part with apprentices. Under By choice a master takes
    // one if they hold a `choose` trait, or the learner is their child or a friend at `friend`
    // closeness or more. The bond ends when the learner is within `end` levels of the master.
    hour: num({ min: 0, max: 23 }),
    friend: count,
    choose: list(text),
    end: count,
    // A child within `reach` of a parent at work learns that skill at `rate` per cent, up to `upTo`.
    child: obj({ rate: percent, upTo: count, reach: num({ min: 1 }) }),
    // A master who dies or leaves with nobody within `near` levels of them takes their skill.
    near: count,
    memories: obj({ master: text, learner: text }),
    // Words for the lines: why a master took this learner, and how a master went.
    words: obj({ law: text, child: text, friend: text, trait: text, died: text, left: text }),
  }),
};
