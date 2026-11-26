// The 6A laws on the Laws page (P6.5, V-157): Rations, Punishment and Sickness, 6B's Hearths and
// Feasts and 6C's New Ways (with the ways the colony knows, V-221), each its setting,
// what it does, since when and everyone's answer, refusals first. A pure read of the world; every
// word is content (laws.json) or the engine's numbers.
import { content } from '../content/index.ts';
import {
  alive,
  clockAt,
  daysToHarvest,
  foodDays,
  lawDef,
  settingOf,
  type WorldState,
} from '../engine/index.ts';
import { answerView } from './law.ts';
import { lordView, namedLord } from './lordview.ts';
import { feastDaysView } from './faithview.ts';
import { colonyWays } from './waysview.ts';
import type { AnswerView, RuledLawView } from './protocol-law.ts';

/** The laws shown this way, in the sheet's order. */
export const RULED = [
  'rations',
  'sickness',
  'punishment',
  'hearths',
  'feasts',
  'apprentices',
  'new-ways',
] as const;

/** The laws on the sheet now: the Lord law joins once his reeve has named him (6C Slice 4). */
export const ruledIds = (world: WorldState): string[] =>
  namedLord(world) ? [...RULED, content.lord.tithe.law] : [...RULED];

const ORDER = ['refuses', 'grumbles', 'obeys'];
const fill = (t: string, vars: Record<string, string | number>): string =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

function on(tick: number): string {
  const c = clockAt(tick, content.calendar);
  return `${c.day} ${content.calendar.monthNames[c.month]!}`;
}

/** What the store holds for a law of the store: days at full plates and at `share`. */
function storeLine(world: WorldState, share: number | undefined): string {
  const { food, days } = foodDays(world, content, alive(world).length);
  const rationed = share ? `, ${Math.floor((days * 100) / share)} at these rations` : '';
  return fill(content.laws.words.store, {
    food,
    full: days,
    rationed,
    harvest: daysToHarvest(world, content),
  });
}

/** One of the 6A laws as the Laws page shows it. */
export function ruledView(world: WorldState, id: string): RuledLawView {
  const def = lawDef(content, id)!;
  const s = settingOf(world, content, id);
  const row = (world.entities['law'] ?? []).find((r) => r['law'] === id);
  const tick = row ? (row['changed'] as number) : undefined;
  const store = def.settings.some((x) => x.share) ? ` ${storeLine(world, s.share)}` : '';
  const lord = id === content.lord.tithe.law ? lordView(world) : undefined;
  const answers: AnswerView[] = (world.entities['answer'] ?? [])
    .filter((a) => a['law'] === id)
    .flatMap((a) => answerView(world, a) ?? [])
    .sort((a, b) => ORDER.indexOf(a.answer) - ORDER.indexOf(b.answer) || a.person - b.person);
  return {
    id,
    name: def.name,
    setting: s.id,
    settings: def.settings.filter((x) => !x.unset).map((x) => ({ id: x.id, name: x.name })),
    about: [s.about, def.note].filter(Boolean).join(' ') + store,
    since:
      tick === undefined
        ? `${s.name}, the custom since the colony began.`
        : `Set to ${s.name} on ${on(tick)}.`,
    why: row ? (row['line'] as number) : world.begunEvent,
    answers,
    ...(id === 'feasts' && { days: feastDaysView(world) }),
    ...(id === 'new-ways' && { ways: colonyWays(world) }),
    ...(lord && { lord }),
  };
}
