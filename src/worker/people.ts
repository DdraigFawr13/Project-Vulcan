// The people as the page shows them (P2.1): each person's row with its skill and trait rows,
// put into words from content. A pure read of the world, like views.ts.
import { content } from '../content/index.ts';
import {
  clockAt,
  declinedLine,
  levelOf,
  moodOf,
  needOf,
  progressOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import { wearingRows } from './clothesview.ts';
import { feedsOf } from './comfort.ts';
import { healthOf } from './healthview.ts';
import { doingOf, nowOf } from './doing.ts';
import { lawOfWalker } from './law.ts';
import { memoriesView, thoughtView } from './memoryview.ts';
import { selfView } from './selfview.ts';
import { talesView } from './taleview.ts';
import { personTools } from './items.ts';
import type { NeedView, PersonView, WalkerView } from './protocol.ts';
import { jobShown } from './jobrows.ts';
import { homeOf, strangerOf } from './strangers.ts';

const nameOf = (list: readonly { id: string; name: string }[], id: string): string =>
  list.find((x) => x.id === id)?.name ?? id;

/** Every person in the world, in id order; `place` names the valley for the arrival screen. */
export function peopleOf(world: WorldState): PersonView[] {
  const year = clockAt(world.tick, content.calendar).year;
  const skills = world.entities['skill'] ?? [];
  const traits = world.entities['trait'] ?? [];
  const { band } = content;
  return shown(world).map((p) => {
    const own = band.skills.flatMap((id) => {
      const row = skills.find((s) => s['person'] === p.id && s['skill'] === id);
      if (!row) return [];
      const [level, potential] = [row['level'] as number, row['potential'] as number];
      return [{ id, name: nameOf(content.abilities, id), level, potential }];
    });
    return {
      id: p.id,
      name: p['name'] as string,
      race: p['race'] as string,
      raceName: nameOf(content.races, p['race'] as string),
      cultureName: nameOf(content.cultures, p['culture'] as string),
      age: year - (p['born'] as number),
      home: p['home'] as string,
      homeDays: p['homeDays'] as number,
      homeDir: p['homeDir'] as string,
      trade: nameOf(content.abilities, p['trade'] as string),
      skills: own,
      known: p['known'] ? nameOf(content.abilities, p['known'] as string) : '',
      // Best first: by level, then potential; the list order breaks ties (the trade's rule).
      best: [...own].sort((a, b) => b.level - a.level || b.potential - a.potential).slice(0, 3),
      able: band.must.filter((m) => own.some((s) => s.id === m && s.level >= band.able)),
      traits: traits
        .filter((t) => t['person'] === p.id)
        .map((t) => {
          const def = content.traits.find((d) => d.id === t['trait']);
          return { name: def?.name ?? String(t['trait']), description: def?.description ?? '' };
        }),
      look: {
        hair: p['hair'] as string,
        hairColour: p['hairColour'] as string,
        clothes: p['clothes'] as string,
      },
      x: p['x'] as number,
      y: p['y'] as number,
      z: p['z'] as number,
      arrived: p['arrived'] as number,
      status: p['status'] as string,
    };
  });
}

/** Everyone, again, when anyone came, stayed or left since the last call; else none. */
export function peopleFeed() {
  let sent = '';
  return {
    next(world: WorldState): PersonView[] | undefined {
      const who = JSON.stringify((world.entities['person'] ?? []).map((p) => [p.id, p['status']]));
      if (who === sent) return undefined;
      sent = who;
      return peopleOf(world);
    },
  };
}

/** Everyone the page shows: the colony and strangers coming or waiting, not those who left. */
const shown = (world: WorldState): EntityRow[] =>
  (world.entities['person'] ?? []).filter((p) => p['status'] !== 'gone');

/** A person's mood and needs as bars. */
function barsOf(world: WorldState, p: EntityRow): { mood: NeedView; needs: NeedView[] } {
  const { life } = content;
  const share = (v: number) => Math.round((v * 100) / life.scale);
  const needs = life.needs.map((def) => {
    const row = needOf(world, p.id, def.id);
    const value = (row?.['value'] as number) ?? 0;
    const low = row?.['low'] === 1;
    const feeds = feedsOf(world, p, def.id);
    return {
      name: def.name,
      share: share(value),
      line: share(def.low),
      word: low ? def.lowWord : def.okWord,
      low,
      why: (row?.['line'] as number) ?? 0,
      ...(feeds && { feeds }),
    };
  });
  const row = moodOf(world, p.id);
  // Under the second word (Steady) the mood reads as a warning.
  const lowAt = life.mood[1]?.at ?? 0;
  const mood = {
    name: 'Mood',
    share: share((row?.['value'] as number) ?? 0),
    line: share(lowAt),
    word: (row?.['word'] as string) ?? '',
    low: ((row?.['value'] as number) ?? 0) < lowAt,
    why: (row?.['line'] as number) ?? 0,
  };
  return { mood, needs };
}

/** Where everyone stands this tick (P2.3), with their needs (P2.2), for every snapshot. */
export const walkersOf = (world: WorldState): WalkerView[] =>
  shown(world).map((p) => ({
    id: p.id,
    x: p['x'] as number,
    y: p['y'] as number,
    z: p['z'] as number,
    ...barsOf(world, p),
    doing: doingOf(p),
    now: nowOf(world, p),
    ...wearingOf(world, p),
    ...withHealth(healthOf(world, p)),
    memories: memoriesView(world, p),
    ...talesView(world, p),
    ...selfView(world, p),
    thought: thoughtView(world, p),
    ...lawOfWalker(world, p),
    tools: personTools(world, p.id),
    skills: skillsOf(world, p),
    ...withHome(homeOf(world, p), strangerOf(world, p)),
    // Rows appear once their station exists (V-071).
    work: content.work.priority.jobs
      .filter((job) => jobShown(world, job))
      .map((job) => {
        const level = levelOf(world, content, p.id, job);
        const declined = declinedLine(world, p.id, job);
        const skill = content.jobs.find((j) => j.id === job)?.skill;
        return {
          job,
          name: nameOf(content.jobs, job),
          ...(skill && { skill }),
          level,
          word: content.work.priority.words[level - 1] ?? '',
          ...(declined !== undefined && { declined }),
        };
      }),
  }));

const withHome = (home: WalkerView['home'], stranger: WalkerView['stranger']) => ({
  ...(home && { home }),
  ...(stranger && { stranger }),
});

/** What a person wears, a row per garment (V-092, V-134); see clothesview.ts. */
const wearingOf = (
  world: WorldState,
  p: EntityRow,
): { wearing?: NonNullable<WalkerView['wearing']> } => {
  const wearing = wearingRows(world, p);
  return wearing.length ? { wearing } : {};
};

const withHealth = (health: WalkerView['health']) => (health ? { health } : {});

/** A person's skills with practice towards the next level (P2.5). */
function skillsOf(world: WorldState, p: EntityRow): WalkerView['skills'] {
  return (world.entities['skill'] ?? [])
    .filter((s) => s['person'] === p.id)
    .map((s) => {
      const [done, needed] = progressOf(content, s);
      const id = s['skill'] as string;
      return {
        id,
        name: nameOf(content.abilities, id),
        level: s['level'] as number,
        potential: s['potential'] as number,
        practice: Math.min(99, Math.floor((done * 100) / needed)),
      };
    });
}
