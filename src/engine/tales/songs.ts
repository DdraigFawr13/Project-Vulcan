// Songs (6B Bundle 5, P6.12, V-188). The bard is whoever puts Bard highest on the Work sheet
// (ties to the sociable, then the lowest id). One free evening each (relaxing after work), the
// bard either works on a song or sings one. A song is made of a big event (a tale with a `song`
// title) the bard holds and nobody has sung of yet, over `bard.evenings` evenings, at most one new
// song a season, one level bigger than the bard's version (`song.made`). It is sung at the tavern,
// or by a lit fire before there is one: everyone relaxing in earshot holds the song's version,
// feels `bard.heard` by the bard's singing (`song.sung`), and the bard practises `bard.skill` (a
// skill row added the first time they sing). A tale in a song still sung is never forgotten.
import {
  clamp,
  clockAt,
  TICKS_PER_DAY,
  today,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { practise } from '../band/index.ts';
import { addEntity, awake } from '../entity/index.ts';
import { highestOn, inTavern, tavernOf } from '../inn/index.ts';
import { hoursOf } from '../law/index.ts';
import { addMemory } from '../needs/index.ts';
import { byAFire } from '../people/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { feedBelief } from './belief.ts';
import { bynameFor, feltAgain, giveByname } from './bynames.ts';
import { apart, fillWords, storiesOf, taleDef, taleText } from './tables.ts';

export const songsOf = (world: WorldState): EntityRow[] => world.entities['song'] ?? [];

/** The bard's singing skill row, added (level 0) the first time they sing. */
function singing(ctx: SystemContext, bard: EntityRow): EntityRow {
  const { world, content } = ctx;
  const skill = content.tavern.bard.skill;
  const row = (world.entities['skill'] ?? []).find(
    (s) => s['person'] === bard.id && s['skill'] === skill,
  );
  if (row) return row;
  const learn = content.abilities.find((a) => a.id === skill)?.learnAttributes ?? [];
  const aptitude = Math.round(
    learn.reduce((t, k) => t + ((bard[k] as number) ?? 0), 0) / Math.max(1, learn.length),
  );
  const [lo, hi] = content.band.potential;
  const potential = clamp(aptitude + content.band.potentialOffset, lo!, hi!);
  const id = addEntity(world, 'skill', { person: bard.id, skill, level: 0, potential, xp: 0 });
  return world.entities['skill']!.find((s) => s.id === id)!;
}

/** Whether a song was made this season already. */
function madeThisSeason(ctx: SystemContext): boolean {
  const { world, content } = ctx;
  const now = clockAt(world.tick, content.calendar);
  return songsOf(ctx.world).some((s) => {
    const c = clockAt((s['day'] as number) * TICKS_PER_DAY, content.calendar);
    return c.year === now.year && c.season === now.season;
  });
}

/** A free evening spent on a song: the one under way, or a new one of a big event the bard
 * holds. False when there is nothing to make. */
function makeSong(ctx: SystemContext, bard: EntityRow, day: number): boolean {
  const { world, content } = ctx;
  const under = songsOf(ctx.world).find((s) => !s['made'] && s['bard'] === bard.id);
  if (under) {
    Object.assign(under, { evenings: (under['evenings'] as number) + 1, day });
    if ((under['evenings'] as number) < content.tavern.bard.evenings) return true;
    const mine = (world.entities['tale'] ?? []).find(
      (t) => t['person'] === bard.id && t['story'] === under['story'],
    );
    under['made'] = ctx.emit('song.made', {
      causes: mine ? [mine['line'] as number] : [],
      actors: [bard.id],
      data: { bard: bard['name'] as string, song: under['name'] as string },
    });
    return true;
  }
  if (madeThisSeason(ctx)) return false;
  const sung = new Set(songsOf(ctx.world).map((s) => s['story'] as number));
  const stories = storiesOf(world);
  const pick = (world.entities['tale'] ?? [])
    .filter((t) => t['person'] === bard.id && !sung.has(t['story'] as number))
    .map((t) => ({ t, story: stories.find((s) => s.id === t['story']) }))
    .filter(({ story }) => story && taleDef(content, story['tale'] as string)?.song)
    .sort((a, b) => b.story!.id - a.story!.id)[0];
  if (!pick) return false;
  const def = taleDef(content, pick.story!['tale'] as string)!;
  const level = Math.min(def.levels.length - 1, (pick.t['level'] as number) + 1);
  addEntity(world, 'song', {
    ...{ story: pick.story!.id, name: fillWords(pick.story!, def.song!), bard: bard.id },
    ...{ level, evenings: 1, day, made: 0, sung: 0 },
  });
  return true;
}

/** Who hears the bard: at the tavern everyone relaxing in it, else everyone relaxing by a lit
 * fire within sight. Empty when there is nowhere to sing. */
function earshot(
  ctx: SystemContext,
  bard: EntityRow,
): { place: 'tavern' | 'hearth'; who: EntityRow[] } {
  const { world, content } = ctx;
  const others = awake(world).filter((p) => p.id !== bard.id && p['doing'] === 'relax');
  if (inTavern(world, bard))
    return { place: 'tavern', who: others.filter((p) => inTavern(world, p)) };
  if (tavernOf(world) || !byAFire(world, content, bard)) return { place: 'hearth', who: [] };
  const near = (p: EntityRow) => byAFire(world, content, p) && apart(p, bard) <= content.life.sight;
  return { place: 'hearth', who: others.filter(near) };
}

/** `p` hears `story` sung at `level`: they hold that version, from the bard, on line `line`. */
function hear(
  ctx: SystemContext,
  p: EntityRow,
  story: EntityRow,
  level: number,
  bard: EntityRow,
  line: number,
) {
  const { world, content } = ctx;
  const day = today(world);
  const def = taleDef(content, story['tale'] as string)!;
  const held = (world.entities['tale'] ?? []).find(
    (t) => t['person'] === p.id && t['story'] === story.id,
  );
  const version = { level, teller: bard.id, line, day };
  if (held) Object.assign(held, version);
  else addEntity(world, 'tale', { person: p.id, story: story.id, ...version, heard: day });
  feedBelief(ctx, p.id, def, level, false, line);
  // A song counts as a telling to each who hears it.
  story['told'] = (story['told'] as number) + 1;
  feltAgain(ctx, p.id, story.id, line);
}

/** The bard sings the song least lately sung to whoever is in earshot; false if they cannot. */
function sing(ctx: SystemContext, bard: EntityRow): boolean {
  const { world, content } = ctx;
  const song = songsOf(ctx.world)
    .filter((s) => s['made'])
    .sort((a, b) => (a['sung'] as number) - (b['sung'] as number) || a.id - b.id)[0];
  const story = song && storiesOf(world).find((s) => s.id === song['story']);
  const { place, who } = earshot(ctx, bard);
  if (!song || !story || !who.length) return false;
  const level = song['level'] as number;
  const line = ctx.emit('song.sung', {
    causes: [song['made'] as number],
    actors: [bard.id],
    data: {
      bard: bard['name'] as string,
      song: song['name'] as string,
      where: content.tales.places[place],
      tale: taleText(content, story, level),
    },
  });
  song['sung'] = world.tick;
  const def = content.tavern.bard;
  const skill = singing(ctx, bard);
  const step = Math.floor((skill['level'] as number) / def.perHeard);
  const memory = def.heard[Math.min(def.heard.length - 1, step)]!;
  for (const p of who) {
    hear(ctx, p, story, level, bard, line);
    addMemory(ctx, p.id, memory, line, bard.id);
  }
  for (let k = 0; k < def.practise; k += 1) practise(ctx, bard, def.skill, song['made'] as number);
  const named = bynameFor(ctx, story, level);
  if (named) giveByname(ctx, named.person, named.word, story, level, line);
  return true;
}

/** Each hour: on a free evening the bard makes or sings a song, once an evening. */
export function songs(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const day = today(world);
  if (state['sang'] === day + 1) return;
  const bard = highestOn(world, content, content.tavern.bard.job, content.tavern.bard.trait);
  if (!bard || bard['doing'] !== 'relax') return;
  const hour = clockAt(world.tick, content.calendar).hour;
  if (hour < hoursOf(world, content, bard.id).workTo) return;
  if (makeSong(ctx, bard, day) || sing(ctx, bard)) state['sang'] = day + 1;
}

/** The stories a song still sung keeps from being forgotten. */
export function sungStories(ctx: SystemContext): Set<number> {
  const keep = ctx.content.tales.forgetDays * TICKS_PER_DAY;
  return new Set(
    songsOf(ctx.world)
      .filter((s) => s['made'] && ctx.world.tick - (s['sung'] as number) < keep)
      .map((s) => s['story'] as number),
  );
}
