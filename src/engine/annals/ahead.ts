// Looking ahead (6T review P3): the last short section of a season's recap, from numbers the game
// already has: the store against the days to the next harvest, who still lies sick, a hungry
// pack, and a smith with no metal. It gives each season a reason to carry on. Each sentence cites
// the line that set it going, or the season's turn.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { alive, personName } from '../entity/index.ts';
import { daysToHarvest, foodDays, haveOf } from '../goods/index.ts';
import { illDef, illsOf } from '../health/index.ts';
import { packOf } from '../wild/index.ts';
import type { Sentence } from './season.ts';
import { cap, fill, midSentence, sentenceOf, type Words } from './words.ts';

const days = (content: EngineContent, n: number): string =>
  fill(content.annals.ahead.days[Math.min(n, content.annals.ahead.days.length - 1)] ?? '{n}', {
    n: content.annals.counts[n] ?? String(n),
  });

/** The store against the harvest: lasts, or runs out so many days short. */
function food(world: WorldState, content: EngineContent, line: number): Sentence {
  const { ahead } = content.annals;
  const left = foodDays(world, content, alive(world).length).days;
  const harvest = daysToHarvest(world, content);
  const { daysPerMonth, monthsPerYear } = content.calendar;
  // The harvest month begins today: the store need only last into it.
  const now = harvest === daysPerMonth * monthsPerYear;
  const words = {
    harvest: days(content, harvest),
    gap: days(content, harvest - left),
    food: days(content, left),
  };
  const text = fill(now ? ahead.now : left >= harvest ? ahead.lasts : ahead.short, words);
  return { section: 'ahead', text, lines: line ? [line] : [], weight: 0 };
}

/** Who still lies sick, citing the line their illness began with. */
function sick(world: WorldState, content: EngineContent): Sentence[] {
  const living = new Set(alive(world).map((p) => p.id));
  const bouts = illsOf(world).filter(
    (r) => r['state'] === 'sick' && living.has(r['person'] as number),
  );
  if (!bouts.length) return [];
  const words: Words[] = bouts.map((r) => ({
    name: personName(world, r['person']),
    ill: illDef(content, r['ill'] as string)?.a ?? (r['ill'] as string),
  }));
  const def = { event: '', weight: 0, ...content.annals.ahead.sick };
  const text = sentenceOf(content, def, '', words);
  const lines = bouts.map((r) => r['line'] as number).filter((l) => l > 0);
  return [{ section: 'ahead', text, lines, weight: 0 }];
}

/** The pack, while it is as hungry as one that comes to the town's edge. */
function pack(world: WorldState, content: EngineContent): Sentence[] {
  const p = packOf(world);
  const hunger = (p?.['hunger'] as number | undefined) ?? 0;
  if (!p || hunger < content.wild.pack.visit) return [];
  const line = ((p['hungryLine'] as number) || (p['line'] as number)) ?? 0;
  const name = midSentence(p['name'] as string);
  const text = fill(content.annals.ahead.pack, { pack: name, days: days(content, hunger) });
  return [{ section: 'ahead', text, lines: line ? [line] : [], weight: 0 }];
}

/** The smith had no metal this season, and the store still holds no ingots. */
function smith(world: WorldState, content: EngineContent, rows: readonly EntityRow[]): Sentence[] {
  const lack = rows.filter((r) => r['type'] === 'smith.noIngots').at(-1);
  const ingots = content.tools.materials.flatMap((m) => (m.ingot ? [m.ingot] : []));
  if (!lack || ingots.some((i) => haveOf(world, content, i) > 0)) return [];
  return [
    {
      section: 'ahead',
      text: content.annals.ahead.smith,
      lines: [lack['event'] as number],
      weight: 0,
    },
  ];
}

/** Looking ahead from the span's end: `rows` are the season's kept lines, `line` its turn. */
export function aheadOf(
  world: WorldState,
  content: EngineContent,
  rows: readonly EntityRow[],
  line: number,
): Sentence[] {
  if (!alive(world).length) return [];
  const out = [food(world, content, line), ...sick(world, content), ...pack(world, content)];
  out.push(...smith(world, content, rows));
  return out.map((s) => ({ ...s, text: cap(s.text) }));
}
