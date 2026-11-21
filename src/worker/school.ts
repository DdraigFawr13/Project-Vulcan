// The schoolroom as the Build sheet shows it (6B Bundle 6, V-189 q7): its row's level, why it
// waits, and its plan once sited; the same shape as the Tavern row. Every value is the engine's
// answer put into words (GAME-02); nothing here chooses a tile or a person (V-041).
import { content } from '../content/index.ts';
import {
  alive,
  buildWantOf,
  dirFrom,
  greenOf,
  homeless,
  keptBooks,
  plansOf,
  rectOf,
  schoolHouse,
  standingSchool,
  type WorldState,
} from '../engine/index.ts';
import type { PastureRow } from './protocol-flock.ts';

/** Why an unsited schoolroom waits, in words. */
function waits(world: WorldState, level: number): string {
  const words = content.work.priority.words;
  const harvest = (world.entities['feast'] ?? []).some(
    (f) => f['eaten'] && !(f['couple'] as number[]).length && !f['holy'],
  );
  const tavern = (world.entities['house'] ?? []).find((h) => h['inn'] === 1);
  if (level >= words.length) return 'waits: the Schoolroom row is at last';
  if (!harvest) return 'waits for the first harvest home';
  if (level > 1 && homeless(world, content).length)
    return 'waits until everyone sleeps under a roof';
  if (tavern?.['state'] === 'plan') return 'waits for the tavern to be built';
  return 'the colony is looking for ground for it';
}

/** "Aldith teaches; 2 books on the shelf", once it stands. */
function stands(world: WorldState): string {
  const s = standingSchool(world);
  const teacher = alive(world).find((p) => p.id === s?.['teacher']);
  const books = keptBooks(world).length;
  const shelf = books === 1 ? '1 book on the shelf' : `${books || 'no'} books on the shelf`;
  return `${teacher ? `${teacher['name'] as string} teaches` : 'nobody teaches yet'}; ${shelf}`;
}

/** The Build sheet's Schoolroom row. */
export function schoolRow(world: WorldState): PastureRow {
  const { level } = buildWantOf(world, content, 'school');
  const want = { level, word: content.work.priority.words[level - 1] ?? '' };
  const h = schoolHouse(world);
  if (!h) return { want, need: waits(world, level) };
  const done = plansOf(world).filter((p) => p['house'] === h.id && (p['done'] as number) > 0);
  const state = h['state'] as string;
  return {
    want,
    need: state === 'built' ? `the schoolroom stands; ${stands(world)}` : 'being built',
    plan: {
      id: h.id,
      state,
      words: `A cottage ${dirFrom(greenOf(world), rectOf(h))} of the green: ${state === 'built' ? 'built' : 'planned'}.`,
      why: h['why'] as string,
      back: state === 'plan' && !h['sent'] && done.length === 0,
      sent: !!h['sent'],
    },
  };
}
