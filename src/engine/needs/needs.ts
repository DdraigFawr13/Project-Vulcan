// Needs and mood (P2.2): every person has a row per need in life.json (food, rest, warmth,
// recreation), 0 to `scale`, and one mood row. Each game hour the needs fall, or rise while the
// person sleeps, sits warm or takes their leisure (people/mind.ts decides what they are doing);
// eating is the one rise that happens on the minute, in the mind. A line is written only when a
// need crosses its warning line, down or back up, or the mood changes word.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { foodGoneLine, itemsAt } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { heatAt } from '../fire/index.ts';
import { tileTemperature } from '../weather/index.ts';
import { bedOwnedBy, houseAt, type Room } from '../build/index.ts';
import { comfortOf, roomHere } from './comfort.ts';

export const NEEDS_TABLES: Schemas = {
  need: {
    person: 'entity',
    /** A life.json need id. */
    need: 'text',
    value: 'int',
    /** 1 while under its warning line. */
    low: 'count',
    /** The last line about it (or the arrival), for "why?". */
    line: 'event',
  },
  mood: { person: 'entity', value: 'int', word: 'text', line: 'event' },
};

const rowsOf = (world: WorldState, kind: string): EntityRow[] => world.entities[kind] ?? [];

/** A person's row for one need. */
export const needOf = (world: WorldState, person: number, need: string): EntityRow | undefined =>
  rowsOf(world, 'need').find((n) => n['person'] === person && n['need'] === need);

export const moodOf = (world: WorldState, person: number): EntityRow | undefined =>
  rowsOf(world, 'mood').find((m) => m['person'] === person);

/** Changes a need by `by`, held between 0 and the scale. */
export function changeNeed(content: EngineContent, row: EntityRow, by: number): void {
  row['value'] = Math.max(0, Math.min(content.life.scale, (row['value'] as number) + by));
}

const wordFor = (content: EngineContent, value: number): string =>
  content.life.mood.find((m) => value >= m.at)?.word ?? content.life.mood.at(-1)!.word;

/** The mood: the needs' mean weighted by their `weight`, in whole numbers. */
function moodValue(content: EngineContent, world: WorldState, person: number): number {
  let sum = 0;
  let weights = 0;
  for (const def of content.life.needs) {
    sum += ((needOf(world, person, def.id)?.['value'] as number) ?? 0) * def.weight;
    weights += def.weight;
  }
  return Math.floor(sum / weights);
}

/** Gives each person their need rows and mood on arrival; the arrival line explains them. */
export function seedNeeds(world: WorldState, content: EngineContent): void {
  for (const p of rowsOf(world, 'person')) {
    const line = p['arrived'] as number;
    content.life.needs.forEach((def, k) =>
      addEntity(world, 'need', {
        person: p.id,
        need: def.id,
        value: content.life.start[k] ?? content.life.scale,
        low: 0,
        line,
      }),
    );
    const value = moodValue(content, world, p.id);
    addEntity(world, 'mood', { person: p.id, value, word: wordFor(content, value), line });
  }
}

const asleep = (p: EntityRow): boolean => p['doing'] === 'sleep' && !(p['path'] as number[]).length;

/** Asleep on their own laid-out bedroll. */
function onBedroll(world: WorldState, p: EntityRow): boolean {
  const here = itemsAt(world, p['x'] as number, p['y'] as number, p['z'] as number);
  return here.some((i) => i['owner'] === p.id && i['state'] === 'laid');
}

/** Asleep in their own bed (P3.5). */
const inBed = (world: WorldState, p: EntityRow): boolean => {
  const bed = bedOwnedBy(world, p.id);
  return !!bed && bed['x'] === p['x'] && bed['y'] === p['y'] && bed['z'] === p['z'];
};

/** The temperature felt at surface tile `i`: the tile's own (weather) plus what lit fires add
 * there (fire, P3.6). */
export function feltAt(world: WorldState, content: EngineContent, i: number): number {
  const temp = tileTemperature(content, world.map, world.systems['weather']?.['temp'] ?? 0, i);
  return temp + heatAt(world, content, i);
}

/** The temperature a person feels where they stand. */
function feels(ctx: SystemContext, p: EntityRow): number {
  const { world, content } = ctx;
  if ((p['z'] as number) > 0) return content.life.warmth.below;
  return feltAt(world, content, (p['y'] as number) * world.map.width + (p['x'] as number));
}

/** Someone else at leisure within reach. */
function company(world: WorldState, content: EngineContent, p: EntityRow): boolean {
  const reach = content.life.relax.reach;
  return rowsOf(world, 'person').some(
    (q) =>
      q.id !== p.id &&
      q['status'] === 'alive' &&
      q['doing'] === 'relax' &&
      q['z'] === p['z'] &&
      Math.abs((q['x'] as number) - (p['x'] as number)) <= reach &&
      Math.abs((q['y'] as number) - (p['y'] as number)) <= reach,
  );
}

/** One hour's change to one need of one person. */
function hourOf(
  ctx: SystemContext,
  p: EntityRow,
  id: string,
  fall: number,
  where: () => Room | undefined,
): number {
  const { world, content } = ctx;
  const life = content.life;
  if (id === 'beauty' || id === 'privacy') return comfortOf(ctx, p, id, where);
  if (id === 'rest' && asleep(p))
    return inBed(world, p)
      ? life.sleep.bed
      : onBedroll(world, p)
        ? life.sleep.bedroll
        : life.sleep.ground;
  if (id === 'warmth') {
    const bed = asleep(p) && (onBedroll(world, p) || inBed(world, p)) ? life.warmth.bedroll : 0;
    const short = life.warmth.comfort - (feels(ctx, p) + bed);
    return short <= 0 ? life.warmth.rise : -short * life.warmth.perDegree;
  }
  if (id === 'recreation' && p['doing'] === 'relax')
    return life.relax.gain + (company(world, content, p) ? life.relax.company : 0);
  return -fall;
}

/** What explains a need going low: the weather spell for cold, the room's building for beauty
 * and privacy (P3.5), else its last line. */
function causeOf(ctx: SystemContext, p: EntityRow, row: EntityRow): number {
  const spell = ctx.world.systems['weather']?.['spell'];
  // Houses stand on the surface: someone below one is not in it (phase review).
  if ((row['need'] === 'beauty' || row['need'] === 'privacy') && p['z'] === 0) {
    const built = houseAt(ctx.world, p['x'] as number, p['y'] as number)?.['built'] as number;
    if (built > 0) return built;
  }
  if (row['need'] === 'warmth' && spell) return spell;
  // Hunger after the food ran out cites the line where the last of it was eaten (P2.6).
  const gone = foodGoneLine(ctx.world);
  return row['need'] === 'food' && gone > (row['line'] as number) ? gone : (row['line'] as number);
}

/** The hourly pass: needs move, crossings and mood changes are written. */
export function runNeeds(ctx: SystemContext): void {
  const { world, content } = ctx;
  const life = content.life;
  for (const p of rowsOf(world, 'person')) {
    if (p['status'] !== 'alive') continue;
    const name = p['name'] as string;
    let worst: EntityRow | undefined;
    // The room they stand in, worked out once an hour and only if a need asks.
    let room: Room | undefined | null = null;
    const where = () => (room === null ? (room = roomHere(ctx, p)) : room);
    for (const def of life.needs) {
      const row = needOf(world, p.id, def.id);
      if (!row) continue;
      changeNeed(content, row, hourOf(ctx, p, def.id, def.fall, where));
      crossed(ctx, p, row, def);
      if (!worst || (row['value'] as number) < (worst['value'] as number)) worst = row;
    }
    const mood = moodOf(world, p.id);
    if (!mood) continue;
    const value = moodValue(content, world, p.id);
    // A better word must be earned by `again` over its threshold, so the mood does not flicker.
    const rank = (w: string) => life.mood.findIndex((m) => m.word === w);
    let word = wordFor(content, value);
    if (rank(word) < rank(mood['word'] as string)) {
      const earned = wordFor(content, value - life.again);
      word = rank(earned) < rank(mood['word'] as string) ? earned : (mood['word'] as string);
    }
    if (word !== mood['word']) {
      const way = value < (mood['value'] as number) ? 'fell' : 'rose';
      mood['line'] = ctx.emit('mood.changed', {
        causes: [worst?.['line'] as number],
        actors: [p.id],
        data: { name, way, word },
      });
      mood['word'] = word;
    }
    mood['value'] = value;
  }
}

/** Writes the line when a need goes under its warning line or gets back over it. */
export function crossed(
  ctx: SystemContext,
  p: EntityRow,
  row: EntityRow,
  def: EngineContent['life']['needs'][number],
): void {
  const value = row['value'] as number;
  const data = { name: p['name'] as string, need: def.name.toLowerCase() };
  if (!row['low'] && value < def.low) {
    row['line'] = ctx.emit('need.low', {
      causes: [causeOf(ctx, p, row)],
      actors: [p.id],
      data: { ...data, word: def.lowWord.toLowerCase() },
    });
    row['low'] = 1;
  } else if (row['low'] && value >= def.low + ctx.content.life.again) {
    row['line'] = ctx.emit('need.met', {
      causes: [row['line'] as number],
      actors: [p.id],
      data: { ...data, word: def.lowWord.toLowerCase(), ok: def.okWord.toLowerCase() },
    });
    row['low'] = 0;
  }
}
