// A feast day's gathering (6B Bundle 4, P6.8, V-187), held by people feast.ts: everyone free
// gathers round the main creed's shrine. Each creed whose priest is there has its rite, led by
// the priest, and its holders there keep it (the day's `rite` memory); then everyone eats the best
// food in store together (the day's `feast` memory), unless the day is kept lean (the
// `feast.lean` memory). On a death's day, those there who knew the dead remember them.
import type { EntityRow } from '../core/index.ts';
import { furnitureKind } from '../build/index.ts';
import { addMemories } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { dayDef } from './days.ts';
import { creedsOf, faithWords, holdersOf, holydaysOf, mainCreed, shrineOf } from './tables.ts';

/** Where a feast day is held: the tiles round the main creed's shrine, with its words. */
export function holyPlace(ctx: SystemContext): { tiles: number[]; words: string } | undefined {
  const { world, content } = ctx;
  const creed = mainCreed(world);
  const shrine = creed && shrineOf(world, creed);
  if (!shrine) return undefined;
  const width = world.map.width;
  const [sx, sy] = [shrine['x'] as number, shrine['y'] as number];
  const tiles: number[] = [];
  for (let dy = -2; dy <= 2; dy += 1)
    for (let dx = -2; dx <= 2; dx += 1) if (dx || dy) tiles.push((sy + dy) * width + sx + dx);
  return { tiles, words: `round the ${furnitureKind(content, shrine).name}` };
}

/** The rites of the day: each creed whose living priest is `there`, citing the supper's call. */
function rites(ctx: SystemContext, feast: EntityRow, day: EntityRow, there: EntityRow[]): void {
  const { world, content } = ctx;
  const ids = new Set(there.map((q) => q.id));
  const def = dayDef(content, day['kind'] as string);
  for (const creed of creedsOf(world)) {
    if (!ids.has(creed['priest'] as number)) continue;
    const keepers = holdersOf(world, creed.id).filter((q) => ids.has(q.id));
    const priest = keepers.find((q) => q.id === creed['priest'])!;
    const shrine = shrineOf(world, creed);
    const line = ctx.emit('faith.rite', {
      causes: [feast['line'] as number, creed['named'] as number].filter((l) => l > 0),
      actors: keepers.map((q) => q.id),
      data: {
        name: priest['name'] as string,
        title: creed['title'] as string,
        faith: faithWords(creed),
        day: day['name'] as string,
        shrine: shrine ? furnitureKind(content, shrine).name : 'shrine',
        count: keepers.length,
      },
    });
    addMemories(
      ctx,
      keepers.map((q) => q.id),
      def.rite,
      line,
      day['about'] as number,
    );
  }
}

/** The feast day's rites and, unless lean, its supper line (`meal` already eaten by `there`);
 * returns the supper's line (the last rite's when lean, else the supper's). */
export function keepHoly(
  ctx: SystemContext,
  feast: EntityRow,
  there: EntityRow[],
  meal: string,
  words: string,
): number {
  const { world, content } = ctx;
  const day = holydaysOf(world).find((d) => d.id === feast['holy']);
  if (!day) return 0;
  const def = dayDef(content, day['kind'] as string);
  rites(ctx, feast, day, there);
  const ids = there.map((q) => q.id);
  const lean = !!feast['lean'];
  const line = lean
    ? (feast['line'] as number)
    : ctx.emit('faith.feast', {
        causes: [feast['line'] as number],
        actors: ids,
        data: { day: day['name'] as string, count: there.length, meal, where: words },
      });
  addMemories(
    ctx,
    ids,
    lean ? content.worship.feast.lean : def.feast,
    line,
    day['about'] as number,
  );
  // Those who were here when the dead died remember them.
  if (def.remember) {
    const knew = there.filter((q) => (q['arrived'] as number) < (day['cause'] as number));
    addMemories(
      ctx,
      knew.map((q) => q.id),
      def.remember,
      line,
      day['about'] as number,
    );
  }
  return line;
}
