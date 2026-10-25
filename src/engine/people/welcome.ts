// How the band weighs a stranger at the green (P5.9, V-117): each colonist speaks for or against,
// for reasons they can name. For: one of their own people, being sociable, being devout toward
// someone fleeing trouble, food that lasts until the next harvest. Against: another people (more
// so for a people who value kin), sickness where they come from, a short store, being solitary or
// greedy when food is short. Memories of earlier newcomers shift it. All numbers are content.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { haveOf } from '../goods/index.ts';
import { memoriesOf } from '../needs/index.ts';

export interface Stance {
  for: boolean;
  /** Their reasons, the strongest first. */
  words: string[];
  /** Everything that weighed, each side the strongest first. */
  pros: string[];
  cons: string[];
}

const alive = (world: WorldState): EntityRow[] =>
  (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** Food in the store, and the days it lasts `mouths` at `strangers.draw.eat` a head. */
export function foodDays(world: WorldState, content: EngineContent, mouths: number) {
  const food = haveOf(world, content, 'food');
  return { food, days: Math.floor(food / (content.strangers.draw.eat * Math.max(1, mouths))) };
}

/** Days until the first day of the harvest month (`weigh.harvest`), next coming. */
export function daysToHarvest(world: WorldState, content: EngineContent): number {
  const { calendar } = content;
  const month = calendar.monthNames.indexOf(content.strangers.weigh.harvest);
  const perYear = calendar.daysPerMonth * calendar.monthsPerYear;
  const today = Math.floor(world.tick / TICKS_PER_DAY) % perYear;
  return (month * calendar.daysPerMonth - today + perYear) % perYear || perYear;
}

/** Whether the store lasts everyone, with `coming` more, until the harvest. */
export function storeLasts(world: WorldState, content: EngineContent, coming: number): boolean {
  return (
    foodDays(world, content, alive(world).length + coming).days >= daysToHarvest(world, content)
  );
}

const skillOf = (world: WorldState, person: number, skill: string): number =>
  ((world.entities['skill'] ?? []).find((r) => r['person'] === person && r['skill'] === skill)?.[
    'level'
  ] as number | undefined) ?? 0;

/** Colonist `q`'s word on stranger `s` (with `coming` people in all) and why. */
export function stanceOf(
  world: WorldState,
  content: EngineContent,
  q: EntityRow,
  s: EntityRow,
  lasts: boolean,
): Stance {
  const w = content.strangers.weigh;
  const parts: [number, string][] = [];
  const kind = content.strangers.kinds.find((k) => k.id === s['reason']);
  const people = (id: string) => content.cultures.find((c) => c.id === id);
  if (q['culture'] === s['culture']) parts.push([w.same, 'one of their own people']);
  else {
    parts.push([w.other, 'another people']);
    if ((people(q['culture'] as string)?.values['kin'] ?? 0) >= w.kin)
      parts.push([w.kinFirst, 'kin first']);
  }
  if (s['reason'] === 'sickness') parts.push([w.sick, 'sickness where they come from']);
  const traits = (world.entities['trait'] ?? [])
    .filter((t) => t['person'] === q.id)
    .map((t) => t['trait'] as string);
  const name = (t: string) => content.traits.find((d) => d.id === t)?.name ?? t;
  if (kind?.need && traits.includes('devout')) parts.push([w.devout, 'devout, toward one in need']);
  const kn = s['known'] as string;
  if (kn && !alive(world).some((c) => skillOf(world, c.id, kn) >= content.band.able)) {
    const noun = content.strangers.known.nouns[kn] ?? kn;
    const skill = content.abilities.find((a) => a.id === kn)?.name ?? kn;
    parts.push([w.skill, `${noun}, and nobody here is able in ${skill.toLowerCase()}`]);
  }
  const month = w.harvest;
  if (lasts) parts.push([w.lasts, `food to last to ${month}`]);
  else {
    parts.push([w.short, `the store before ${month}`]);
    if (traits.includes('greedy')) parts.push([w.greedy, name('greedy')]);
  }
  for (const t of traits) if (w.traits[t]) parts.push([w.traits[t]!, name(t)]);
  for (const m of memoriesOf(world, q.id)) {
    const by = w.memories[m['memory'] as string];
    if (by) parts.push([by, 'one turned away before']);
  }
  const sum = parts.reduce((n, [by]) => n + by, w.start);
  const yes = sum > 0;
  const side = (pro: boolean) => [
    ...new Set(
      parts
        .filter(([by]) => (pro ? by > 0 : by < 0))
        .sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]))
        .map(([, word]) => word),
    ),
  ];
  const [pros, cons] = [side(true), side(false)];
  return { for: yes, words: yes ? pros : cons, pros, cons };
}
