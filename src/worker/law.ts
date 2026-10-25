// The work-hours law as the page shows it (P4.8, V-091): the Laws page, each person's answer and
// reason, the warmth line and what each memory leans. A pure read of the world, like people.ts.
import { content } from '../content/index.ts';
import {
  clockAt,
  customaryHours,
  findEvent,
  lawDef,
  lawHours,
  leanOf,
  settingOf,
  warmLineOf,
  WORK_HOURS,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { AnswerView, LawView, WalkerView } from './protocol.ts';

const ORDER = ['refuses', 'grumbles', 'obeys'];
const hh = (h: number): string => `${String(h % 24).padStart(2, '0')}:00`;
const share = (v: number): number => Math.round((v * 100) / content.life.scale);

function at(tick: number): string {
  const c = clockAt(tick, content.calendar);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(c.hour)}:${pad(c.minute)}, Day ${c.day} of ${content.calendar.monthNames[c.month]!}`;
}

const words = (s: unknown): string[] => (typeof s === 'string' && s ? s.split('|') : []);

/** One person's answer in words: "Hrakmar refuses the long days and keeps the customary hours." */
export function answerView(world: WorldState, a: EntityRow): AnswerView | undefined {
  const p = (world.entities['person'] ?? []).find((q) => q.id === a['person']);
  if (!p) return undefined;
  const s = settingOf(world, content, a['law'] as string);
  const name = p['name'] as string;
  const answer = a['answer'] as AnswerView['answer'];
  const text = {
    obeys: `${name} keeps ${s.days}.`,
    grumbles: `${name} keeps ${s.days}, grumbling.`,
    refuses: `${name} refuses ${s.days} and keeps the customary hours.`,
  }[answer];
  const memories = (world.entities['memory'] ?? []).filter((m) => m['person'] === p.id);
  const links = (a['cites'] as number[]).flatMap((line) => {
    const m = memories.find((r) => r['line'] === line);
    const def = content.memories.find((d) => d.id === m?.['memory']);
    if (!def) return [];
    const about = (world.entities['person'] ?? []).find((q) => q.id === m!['about']);
    return [
      { text: def.text.replace('{about}', (about?.['name'] as string) ?? 'someone'), why: line },
    ];
  });
  const line = a['line'] as number;
  const tick = findEvent(world.log, line)?.tick;
  return {
    person: p.id,
    name,
    answer,
    text,
    for: words(a['pro']),
    against: words(a['con']),
    links,
    why: line,
    since: tick === undefined ? '' : `since ${at(tick)}`,
  };
}

/** The Laws page: the work-hours law, this season's hours and everyone's answer, refusals first. */
export function lawView(world: WorldState): Omit<LawView, 'strangers'> {
  const def = lawDef(content, WORK_HOURS)!;
  const s = settingOf(world, content, def.id);
  const row = (world.entities['law'] ?? []).find((r) => r['law'] === def.id);
  const answers = (world.entities['answer'] ?? [])
    .filter((a) => a['law'] === def.id)
    .flatMap((a) => answerView(world, a) ?? [])
    .sort((a, b) => ORDER.indexOf(a.answer) - ORDER.indexOf(b.answer) || a.person - b.person);
  const hours = lawHours(world, content);
  const custom = customaryHours(world, content);
  const span = (from: number, to: number) => `${hh(from)} to ${hh(to)}`;
  const winter = s.winter ?? content.work.hours;
  const about = s.hours
    ? `${s.name}: work ${span(s.hours.from, s.hours.to)}, in winter ${span(winter.from, winter.to)}; bed at ${hh(hours.sleepFrom)}. Customary is ${span(custom.workFrom, custom.workTo)} now.`
    : `Customary: work ${span(content.work.hours.from, content.work.hours.to)}, in winter ${span(winter.from, winter.to)}; bed at ${hh(hours.sleepFrom)}.`;
  const tick = row ? (row['changed'] as number) : undefined;
  return {
    id: def.id,
    name: def.name,
    setting: s.id,
    settings: def.settings.map((x) => ({ id: x.id, name: x.name })),
    hours,
    customary: custom,
    about,
    since:
      tick === undefined ? `${s.name} since the band arrived.` : `Set to ${s.name} at ${at(tick)}.`,
    why: row ? (row['line'] as number) : world.begunEvent,
    answers,
  };
}

/** A walker's answer, warmth line and memories' leans (P4.8). */
export function lawOfWalker(world: WorldState, p: EntityRow): Pick<WalkerView, 'law' | 'warmLine'> {
  const a = (world.entities['answer'] ?? []).find(
    (r) => r['person'] === p.id && r['law'] === WORK_HOURS,
  );
  const law = a && answerView(world, a);
  const usual = content.life.needs.find((n) => n.id === 'warmth')?.low ?? 0;
  const line = warmLineOf(world, content, p.id);
  const { traits, memories } = content.life.warmthLine;
  const why: string[] = [];
  for (const t of world.entities['trait'] ?? [])
    if (t['person'] === p.id && traits[t['trait'] as string])
      why.push(content.traits.find((d) => d.id === t['trait'])?.name ?? (t['trait'] as string));
  const held = (world.entities['memory'] ?? []).filter(
    (m) => m['person'] === p.id && memories[m['memory'] as string],
  );
  for (const id of new Set(held.map((m) => m['memory'] as string))) {
    const n = held.filter((m) => m['memory'] === id).length;
    const text = content.memories.find((d) => d.id === id)?.text.toLowerCase() ?? id;
    why.push(n > 1 ? `${text} (${n})` : text);
  }
  const text =
    line === usual
      ? `${share(line)}, as usual.`
      : `${share(line)}, not the usual ${share(usual)}: ${why.join(', ')}. ${line < usual ? 'Leaves work for a fire later than most.' : 'Leaves work for a fire sooner than most.'}`;
  return { ...(law && { law }), warmLine: { line: share(line), usual: share(usual), text } };
}

/** What a memory leans on the law's setting now, in words, if anything. */
export const leanWords = (world: WorldState, memory: string): string | undefined =>
  leanOf(settingOf(world, content, WORK_HOURS), memory);
