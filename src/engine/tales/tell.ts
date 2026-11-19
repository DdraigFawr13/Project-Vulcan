// Telling (P6.3, V-155, V-162): each hour, two awake people together may pass a tale: eating
// together or at leisure within `life.relax.reach` tiles, side by side at work (2 tiles), or by a
// lit fire on a winter evening (within `see` tiles), at tales.json `pass` per cent. The teller tells the newest story
// the other has not heard (someone under `perDay` new tales today). A telling can bend it one
// level: `bend.chance` per cent plus the teller's traits, and `softer` per cent of bends tone it
// down. Each telling is a `tale.told` line citing the teller's own line for it, so "why?" walks
// back from any version to the event; the listener holds that version and may believe it.
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { byAFire, winterEvening } from '../people/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { feedBelief } from './belief.ts';
import { storiesOf, taleDef, taleText } from './tables.ts';

const WORK_REACH = 2;

const apart = (a: EntityRow, b: EntityRow): number =>
  a['z'] !== b['z']
    ? Infinity
    : Math.max(
        Math.abs((a['x'] as number) - (b['x'] as number)),
        Math.abs((a['y'] as number) - (b['y'] as number)),
      );

type Place = 'meal' | 'leisure' | 'work' | 'hearth';

/** Where `a` and `b` are together this hour, if they are. */
function placeOf(ctx: SystemContext, a: EntityRow, b: EntityRow): Place | undefined {
  const { world, content } = ctx;
  const reach = content.life.relax.reach;
  const d = apart(a, b);
  const both = (...doing: string[]) =>
    doing.includes(a['doing'] as string) && doing.includes(b['doing'] as string);
  if (both('eat', 'feast') && d <= reach) return 'meal';
  if (both('work') && d <= WORK_REACH) return 'work';
  if (!both('relax')) return undefined;
  // Round one fire: both warmed by a fire and within sight of each other.
  const fire =
    winterEvening(world, content) && byAFire(world, content, a) && byAFire(world, content, b);
  if (fire && d <= content.tales.see) return 'hearth';
  return d <= reach ? 'leisure' : undefined;
}

/** The newest story `teller` holds that `listener` has not heard, if `listener` can hear more. */
function toTell(ctx: SystemContext, teller: EntityRow, listener: EntityRow, day: number) {
  const tales = ctx.world.entities['tale'] ?? [];
  const heard = tales.filter((t) => t['person'] === listener.id);
  const today = heard.filter((t) => t['teller'] !== 0 && t['heard'] === day);
  if (today.length >= ctx.content.tales.pass.perDay) return undefined;
  const known = new Set(heard.map((t) => t['story'] as number));
  return tales
    .filter((t) => t['person'] === teller.id && !known.has(t['story'] as number))
    .sort((a, b) => (b['story'] as number) - (a['story'] as number))[0];
}

/** The level a telling leaves: the same, or one up or down. */
function bent(ctx: SystemContext, teller: EntityRow, level: number, most: number): number {
  const { bend } = ctx.content.tales;
  const traits = (ctx.world.entities['trait'] ?? []).filter((t) => t['person'] === teller.id);
  const chance = traits.reduce((c, t) => c + (bend.traits[t['trait'] as string] ?? 0), bend.chance);
  const rng = ctx.rng();
  if (rng.int(100) >= chance) return level;
  const to = rng.int(100) < bend.softer ? level - 1 : level + 1;
  return Math.max(0, Math.min(most, to));
}

function tell(
  ctx: SystemContext,
  [teller, listener]: [EntityRow, EntityRow],
  mine: EntityRow,
  place: Place,
  day: number,
) {
  const { world, content } = ctx;
  const story = storiesOf(world).find((s) => s.id === mine['story']);
  const def = story && taleDef(content, story['tale'] as string);
  if (!story || !def) return;
  const was = mine['level'] as number;
  const level = bent(ctx, teller, was, def.levels.length - 1);
  const line = ctx.emit('tale.told', {
    causes: [mine['line'] as number],
    actors: [teller.id, listener.id],
    data: {
      teller: teller['name'] as string,
      listener: listener['name'] as string,
      where: content.tales.places[place],
      tale: taleText(content, story, level),
      bent:
        level > was ? ' It grew in the telling.' : level < was ? ' It shrank in the telling.' : '',
    },
  });
  mine['day'] = day;
  addEntity(world, 'tale', {
    person: listener.id,
    story: story.id,
    level,
    teller: teller.id,
    line,
    heard: day,
    day,
  });
  feedBelief(ctx, listener.id, def, level, false, line);
}

/** This hour's tellings, pair by pair in id order. */
export function tellings(ctx: SystemContext): void {
  const { world } = ctx;
  const day = Math.floor(world.tick / TICKS_PER_DAY);
  const awake = (world.entities['person'] ?? []).filter(
    (p) => p['status'] === 'alive' && p['doing'] !== 'sleep',
  );
  if (!(world.entities['tale'] ?? []).length) return;
  for (let i = 0; i < awake.length; i += 1)
    for (let j = i + 1; j < awake.length; j += 1) {
      const [a, b] = [awake[i]!, awake[j]!];
      const place = placeOf(ctx, a, b);
      if (!place || ctx.rng().int(100) >= ctx.content.tales.pass[place]) continue;
      const ab = toTell(ctx, a, b, day);
      const ba = toTell(ctx, b, a, day);
      if (ab && (!ba || ctx.rng().int(2) === 0)) tell(ctx, [a, b], ab, place, day);
      else if (ba) tell(ctx, [b, a], ba, place, day);
    }
}

/** A tale heard but neither told nor heard again for `forgetDays` is forgotten (one seen stays),
 * and a story nobody holds goes. */
export function forget(ctx: SystemContext): void {
  const { world, content } = ctx;
  const day = Math.floor(world.tick / TICKS_PER_DAY);
  const tales = world.entities['tale'] ?? [];
  world.entities['tale'] = tales.filter(
    (t) => t['teller'] === 0 || day - (t['day'] as number) < content.tales.forgetDays,
  );
  const held = new Set(world.entities['tale'].map((t) => t['story'] as number));
  world.entities['story'] = storiesOf(world).filter((s) => held.has(s.id));
}
