// The tales a person holds and what they believe, as the Memories tab shows them (P6.3, V-155):
// each tale in their version with the truth beside it when it differs, where they got it, and
// each belief in words with its strength. Words only; the rules live in engine tales. A pure read.
import { content } from '../content/index.ts';
import {
  beliefsOf,
  bynameOf,
  recordOf,
  storiesOf,
  taleDef,
  talesOf,
  taleText,
  type EntityRow,
  type WorldState,
  personName,
} from '../engine/index.ts';
import { dayWords } from './memoryview.ts';
import type { TaleView, WalkerView } from './protocol-people.ts';

/** `p`'s tales, newest first, and beliefs, strongest first. */
export function talesView(
  world: WorldState,
  p: EntityRow,
): Pick<WalkerView, 'tales' | 'beliefs' | 'byname'> {
  const stories = new Map(storiesOf(world).map((s) => [s.id, s]));
  const tales = talesOf(world, p.id).flatMap((t) => {
    const story = stories.get(t['story'] as number);
    const def = story && taleDef(content, story['tale'] as string);
    if (!story || !def) return [];
    const level = t['level'] as number;
    const teller = t['teller'] as number;
    const day = dayWords(t['heard'] as number);
    const how: TaleView['how'] = teller ? 'Heard' : def.word ? 'Word' : 'Saw';
    const from = {
      Heard: `Heard from ${personName(world, teller, 'someone')}, ${day}`,
      Word: `Brought word of it, ${day}`,
      Saw: 'Saw it',
    }[how];
    const text = `“${taleText(content, story, level)}”`;
    const truth = level === def.truth ? undefined : taleText(content, story, def.truth);
    return [{ how, text, ...(truth ? { truth } : {}), from, why: t['line'] as number }];
  });
  const words = content.tales.strength;
  const beliefs = beliefsOf(world, p.id).flatMap((b) => {
    const def = content.tales.beliefs.find((d) => d.id === b['belief']);
    const strength = words[Math.min(words.length, b['strength'] as number) - 1];
    return def && strength ? [{ text: `${strength} ${def.text}.`, why: b['line'] as number }] : [];
  });
  return { tales, beliefs, ...bynameView(world, p) };
}

/** `p`'s byname: the word, the tale as told when it stuck and what happened (6B Bundle 5). */
function bynameView(world: WorldState, p: EntityRow): Pick<WalkerView, 'byname'> {
  const b = bynameOf(world, p.id);
  if (!b) return {};
  const story = storiesOf(world).find((s) => s.id === b['story']);
  const def = story && taleDef(content, story['tale'] as string);
  const line = recordOf(world, b['line'] as number);
  const told = line && 'data' in line ? String(line.data['tale'] ?? '') : '';
  const truth = story && def ? taleText(content, story, def.truth) : '';
  return {
    byname: { word: b['word'] as string, text: told, truth, why: b['line'] as number },
  };
}
