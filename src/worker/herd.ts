// What a herder is doing, in content `work.doing` words (Phase 5 Bundle 3): a pure read of the
// person's task and the flock it concerns (GAME-02).
import { content } from '../content/index.ts';
import {
  animalWord,
  clockAt,
  flocksOf,
  headOf,
  keptOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';

const article = (word: string): string => (/^[aeiou]/.test(word) ? 'an' : 'a');

/** The `work.doing` key and its words for a person whose job is herding. */
export function herdDoing(
  world: WorldState,
  p: EntityRow,
): { key: string; vars: Record<string, string> } {
  const task = p['task'] as string;
  const flock = flocksOf(world).find((f) => f.id === p['plan']);
  if (task === 'tame') {
    const herd = (world.entities['herd'] ?? []).find((h) => h.id === p['target']);
    const kind = content.flock.kinds.find((k) => k.species === herd?.['species']);
    const month = content.calendar.monthNames[clockAt(world.tick, content.calendar).month]!;
    const word =
      (content.flock.tame.young.includes(month) ? kind?.youngName : kind?.femaleName) ?? '';
    return {
      key: 'tame',
      vars: {
        a: article(word),
        kind: word,
        species: kind?.species ?? '',
        have: String(flock ? headOf(world, flock) : 0),
        holds: String(content.flock.pasture.holds),
      },
    };
  }
  if (task === 'butcher') {
    const animal = flock && keptOf(world, flock).find((a) => a.id === p['target']);
    const word = animal ? animalWord(content, animal) : '';
    return { key: 'butcher', vars: { a: article(word), kind: word } };
  }
  return { key: task, vars: {} };
}
