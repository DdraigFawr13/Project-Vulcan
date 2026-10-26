// The people as the page shows them (P2.1): each person's row with its skill and trait rows,
// put into words from content. A pure read of the world, like views.ts.
import { content } from '../content/index.ts';
import {
  clockAt,
  cropNow,
  declinedLine,
  fieldsOf,
  itemsOf,
  levelOf,
  loadOf,
  memoriesOf,
  moodOf,
  needOf,
  nextNeed,
  partOf,
  plansOf,
  progressOf,
  stockOf,
  TICKS_PER_DAY,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import { wearingRows } from './clothesview.ts';
import { feedsOf } from './comfort.ts';
import { careNow } from './health.ts';
import { deadNow, healthOf } from './healthview.ts';
import { hearthDoing, tendDoing } from './fires.ts';
import { herdDoing } from './herd.ts';
import { carpentryDoing } from './furniture.ts';
import { lawOfWalker, leanWords } from './law.ts';
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

/** What a person is doing, in words (P2.2). */
function doingOf(p: EntityRow): string {
  const walking = (p['path'] as number[]).length > 0;
  if (p['status'] === 'dead') return 'Dead';
  if (p['doing'] === 'hurt') return 'Lying hurt';
  if (p['doing'] === 'work' && p['job'] === 'carry') return 'Carrying the hurt';
  if (p['doing'] === 'work' && ['bind', 'dress', 'feed'].includes(p['job'] as string))
    return 'Tending the hurt';
  if (p['doing'] === 'work' && p['job'] === 'bury') return 'Burying the dead';
  if (p['doing'] === 'sleep') return walking ? 'Going to bed' : 'Sleeping';
  if (p['doing'] === 'eat') return walking ? 'Going to eat' : 'Eating';
  if (p['doing'] === 'relax') return 'Taking it easy';
  if (p['doing'] === 'work' && p['job'] === 'fell')
    return walking ? 'Going to fell a tree' : 'Felling';
  if (p['doing'] === 'work' && p['job'] === 'quarry')
    return walking ? 'Going to a boulder' : 'Quarrying';
  if (p['doing'] === 'work' && p['job'] === 'build') return walking ? 'Going to build' : 'Building';
  if (p['doing'] === 'work' && p['job'] === 'carpentry')
    return walking ? 'Going to make furniture' : 'Making furniture';
  if (p['doing'] === 'work' && p['job'] === 'hearth')
    return walking ? 'Going to make a hearth' : 'Making a hearth';
  if (p['doing'] === 'work' && p['job'] === 'tend')
    return walking ? 'Going to a fire' : 'Tending a fire';
  if (p['doing'] === 'warm') return 'Warming up';
  if (p['doing'] === 'watch') return walking ? 'Going to the fold' : 'Keeping watch';
  if (p['doing'] === 'work') return walking ? 'Carrying to the store' : 'Hauling';
  return walking ? 'Strolling' : 'Idle';
}

/** What a person is doing and why, in the words of content `work.doing` (P2.9): the sentence,
 * and the line where they took the work up when it has one. */
export function nowOf(world: WorldState, p: EntityRow): WalkerView['now'] {
  const words = content.work.doing;
  const walking = (p['path'] as number[]).length > 0;
  const say = (key: string, vars: Record<string, string> = {}): string =>
    (words[key] ?? '').replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
  const doing = p['doing'] as string;
  const gone = deadNow(world, p);
  if (gone) return gone;
  const care = careNow(world, p, say);
  if (care) return { text: care };
  if (doing === 'sleep') return { text: say(walking ? 'goSleep' : 'sleep') };
  if (doing === 'eat') return { text: say(walking ? 'goEat' : 'eat') };
  if (doing === 'relax') return { text: say('relax') };
  if (doing === 'warm') return { text: say('warm') };
  if (doing === 'watch') return { text: say(walking ? 'goWatch' : 'watch') };
  if (doing !== 'work') return { text: say(walking ? 'stroll' : 'idle') };
  const job = p['job'] as string;
  const took = p['took'] as number;
  const why = took !== undefined && took > 0 ? { why: took } : {};
  if (job === 'build') {
    const plan = plansOf(world).find((r) => r.id === p['plan']);
    const part = plan && partOf(content, plan['part'] as string);
    const carrying = loadOf(world, p.id);
    const next = plan && nextNeed(content, plan);
    const key = plan?.['state'] === 'down' ? 'takeDown' : next && !carrying ? 'fetch' : 'build';
    const what = nameOf(content.items, next ? next.material : (part?.material ?? ''));
    return { text: say(key, { part: part?.name ?? '', what }), ...why };
  }
  if (job === 'carpentry') {
    const { key, vars } = carpentryDoing(world, p);
    return { text: say(key, vars), ...why };
  }
  if (job === 'tend') {
    const { key, vars } = tendDoing(world, p);
    return { text: say(key, vars), ...why };
  }
  if (job === 'cook' || job === 'charcoal' || job === 'smelt' || job === 'station')
    return { text: say(job), ...why };
  if (job === 'smith') {
    const [tool = ''] = String(p['making']).split(':');
    const who = (world.entities['person'] ?? []).find((q) => q.id === p['plan']);
    return { text: say('smith', { tool, who: (who?.['name'] as string) ?? '' }), ...why };
  }
  if (job === 'farm') {
    const f = fieldsOf(world).find((r) => r.id === p['plan']);
    const crop =
      f &&
      (content.buildings.field.crops.find((c) => c.id === f['crop']) ?? cropNow(world, content, f));
    const seed = loadOf(world, p.id)?.['kind'] === content.buildings.field.seed;
    const key = f?.['state'] === 'ripe' ? 'reap' : seed ? 'sow' : 'fetchSeed';
    return { text: say(key, { crop: crop?.name ?? '' }), ...why };
  }
  if (job === 'herd') {
    const { key, vars } = herdDoing(world, p);
    return { text: say(key, vars), ...why };
  }
  if (job === 'hearth') return { text: say('hearth', hearthDoing(world, p)), ...why };
  if (job === 'mine') {
    // Sinking, tunnelling or mining for a metal's ingot plate, or digging clay for a wall.
    const task = p['task'] as string;
    const what = p['what'] as string;
    const plate = content.work.stock.find((s) => s.good === `${what}-ingot`);
    const level = plate && (stockOf(world, plate.good)?.['level'] as string | undefined);
    const vars = { metal: what, part: what, good: plate?.name ?? '', level: level ?? '' };
    return { text: say(task === 'sink' ? 'shaft' : task, vars), ...why };
  }
  if (job === 'fell' || job === 'forage' || job === 'quarry') {
    const tile = p['target'] as number;
    const feature = job === 'forage' && tile >= 0 ? world.map.features[tile] : 0;
    const herbs = !!feature && content.features[feature - 1]?.kind === 'herb';
    const good =
      job === 'fell'
        ? content.work.stock[0]?.good
        : job === 'quarry'
          ? content.work.quarry.good
          : herbs
            ? content.work.forage.herbs.good
            : content.work.forage.good;
    const def = content.work.stock.find((s) => s.good === good);
    const level = (good && stockOf(world, good)?.['level']) as string | undefined;
    return {
      text: say(herbs ? 'forageHerbs' : job, { good: def?.name ?? good ?? '', level: level ?? '' }),
      ...why,
    };
  }
  const items = itemsOf(world);
  const item = loadOf(world, p.id) ?? items.find((i) => i.id === (p['target'] as number));
  return { text: say('haul', { what: item ? nameOf(content.items, item['kind'] as string) : '' }) };
}

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

/** A person's live memories in words from memories.json, with the days before each fades. */
function memoriesView(world: WorldState, p: EntityRow): WalkerView['memories'] {
  const people = world.entities['person'] ?? [];
  return memoriesOf(world, p.id).flatMap((m) => {
    const def = content.memories.find((d) => d.id === m['memory']);
    if (!def) return [];
    const about = people.find((q) => q.id === m['about'])?.['name'] as string | undefined;
    return [
      {
        text: def.text.replace('{about}', about ?? 'someone'),
        mood: def.mood,
        days: Math.max(1, Math.ceil(((m['until'] as number) - world.tick) / TICKS_PER_DAY)),
        why: m['line'] as number,
        ...withLean(leanWords(world, m['memory'] as string)),
      },
    ];
  });
}

const withHealth = (health: WalkerView['health']) => (health ? { health } : {});

const withLean = (lean: string | undefined) => (lean ? { lean } : {});

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
