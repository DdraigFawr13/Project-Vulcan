// The brewer (6B Bundle 5, P6.12, V-188): the Brewing row of the Work sheet. Nobody is told to brew.
// A free, able person takes it up while the tavern's cups (in its casks, and in brews under way)
// are under the Ale plate and a built cask in the tavern stands empty: the first of
// `tavern.brew.recipes` with `count` of one of its items in the store, grain (ale) only while the
// colony's food is above its Food plate (else one `tavern.noGrain` line until it is again). They
// fetch the grain or honey, work `minutes × 2 × skilled ÷ (skilled + level)` beside the brewing
// tub (cooking skill) and fill the cask with `cups` cups, ready `days` days later
// (`tavern.brewed`). `p.plan` is the cask, `p.make` the drink.
import { itemName, TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { furnitureOf, roomAt, rectOf, tavernHouse } from '../build/index.ts';
import { haveOf, itemsOf, layItem, loadOf, stockOf, takeFrom } from '../goods/index.ts';
import { wantOf } from '../goods/index.ts';
import { cupsHeld, fillCask, kegsOf, tavernName, tavernOf } from '../inn/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { stacksOf } from './chandle.ts';
import { able, goBeside, outranked, people, practise, priorityLine } from '../band/index.ts';
import { same, skillOf, spotOf, walkTo } from '../band/index.ts';

type Recipe = SystemContext['content']['tavern']['brew']['recipes'][number];

const skillName = (ctx: SystemContext): string =>
  ctx.content.jobs.find((j) => j.id === ctx.content.tavern.brew.job)?.skill ?? '';

function stop(p: EntityRow): false {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '' });
  return false;
}

/** The built pieces of `kind` inside the built tavern. */
function piecesIn(ctx: SystemContext, kind: string): EntityRow[] {
  const { world, content } = ctx;
  const h = tavernHouse(world);
  if (!h || h['state'] !== 'built') return [];
  const r = rectOf(h);
  const room = roomAt(world, content, r.x + 1, r.y + 1);
  if (!room) return [];
  const tiles = new Set(room.tiles);
  const width = world.map.width;
  return furnitureOf(world).filter(
    (f) =>
      f['kind'] === kind &&
      f['state'] === 'built' &&
      f['z'] === 0 &&
      tiles.has((f['y'] as number) * width + (f['x'] as number)),
  );
}

interface Pick {
  recipe: Recipe;
  cask: EntityRow;
  tub: EntityRow;
  stack?: EntityRow;
  /** Grain is there but kept for eating. */
  kept?: true;
}

/** What `p` would brew now: an empty cask, the tub, the recipe and its stack. */
function pick(ctx: SystemContext, p: EntityRow): Pick | undefined {
  const { world, content } = ctx;
  const def = content.tavern.brew;
  const tub = piecesIn(ctx, def.tub)[0];
  if (!tub || !tavernOf(world)) return undefined;
  const others = people(world).filter((q) => q.id !== p.id && q['job'] === def.job);
  const coming = others.length * def.cups;
  if (cupsHeld(world) + coming >= wantOf(world, content, content.tavern.stock)) return undefined;
  const full = new Set(
    kegsOf(world)
      .filter((k) => (k['cups'] as number) > 0)
      .map((k) => k['piece']),
  );
  const claimed = new Set(others.map((q) => q['plan']));
  const cask = piecesIn(ctx, def.cask).find((c) => !full.has(c.id) && !claimed.has(c.id));
  if (!cask) return undefined;
  const fed = haveOf(world, content, 'food') > wantOf(world, content, 'food');
  let kept: true | undefined;
  for (const recipe of def.recipes) {
    const stack = recipe.from
      .flatMap((k) => stacksOf(ctx, p, k))
      .filter((i) => (i['count'] as number) >= recipe.count)
      .sort((a, b) => a.id - b.id)[0];
    if (!stack) continue;
    // Grain is food first: ale only while the store has food past its plate.
    if (recipe.drink === 'ale' && !fed) {
      kept = true;
      continue;
    }
    return { recipe, cask, tub, stack };
  }
  return kept && { recipe: def.recipes[0]!, cask, tub, kept };
}

/** Says once, until brewing is possible again, that the grain is kept for eating. */
function keptForEating(ctx: SystemContext, p: EntityRow): void {
  const t = tavernOf(ctx.world);
  if (!t || t['noGrain']) return;
  const food = stockOf(ctx.world, 'food');
  t['noGrain'] = ctx.emit('tavern.noGrain', {
    causes: [food?.['line'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string, tavern: tavernName(ctx.world) },
  });
}

/** Takes up brewing if the tavern wants ale and nobody free who puts it higher could. */
export function takeUpBrewing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.tavern.brew;
  const can = (q: EntityRow) => !!pick(ctx, q)?.stack;
  if (!able(content, p, def.job) || outranked(ctx, p, def.job, can)) return false;
  const got = pick(ctx, p);
  if (!got) return false;
  if (!got.stack) {
    keptForEating(ctx, p);
    return false;
  }
  const t = tavernOf(world)!;
  t['noGrain'] = 0;
  const plate = stockOf(world, content.tavern.stock);
  p['took'] = ctx.emit('tavern.tookUp', {
    causes: [plate?.['line'] as number, priorityLine(world, p.id, def.job)].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: { name: p['name'] as string, why: `the casks hold ${cupsHeld(world)} cups` },
  });
  const level = skillOf(world, p, skillName(ctx));
  Object.assign(p, {
    job: def.job,
    plan: got.cask.id,
    target: got.stack.id,
    make: got.recipe.drink,
    work: Math.ceil((def.minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return brewing(ctx, p);
}

/** At the stack: take what the brew needs. */
function gather(ctx: SystemContext, p: EntityRow, recipe: Recipe): boolean {
  const { world } = ctx;
  let stack = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (!stack || !recipe.from.includes(stack['kind'] as string)) return stop(p);
  if ((stack['count'] as number) < recipe.count) return stop(p);
  if (!same(spotOf(stack), spotOf(p))) return walkTo(ctx, p, spotOf(stack)) || stop(p);
  if (stack['count'] !== recipe.count) {
    const made = stack['made'] as number;
    const kind = stack['kind'] as string;
    takeFrom(world, stack, recipe.count);
    const id = layItem(world, { kind, count: recipe.count, ...spotOf(p), made });
    stack = itemsOf(world).find((i) => i.id === id)!;
  }
  stack['holder'] = p.id;
  p['target'] = -1;
  return true;
}

/** One minute of brewing: false when the cask is filled, or the tub or cask is gone. */
export function brewing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.tavern.brew;
  const recipe = def.recipes.find((r) => r.drink === p['make']);
  const cask = piecesIn(ctx, def.cask).find((c) => c.id === p['plan']);
  const tub = piecesIn(ctx, def.tub)[0];
  if (!recipe || !cask || !tub) return stop(p);
  const load = loadOf(world, p.id);
  if (!load) return gather(ctx, p, recipe);
  if (!recipe.from.includes(load['kind'] as string)) return stop(p);
  const [x, y] = [tub['x'] as number, tub['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(ctx), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const line = ctx.emit('tavern.brewed', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      from: `${recipe.count} ${itemName(content, load['kind'] as string)}`,
      drink: recipe.drink,
      tavern: tavernName(world),
      days: def.days,
    },
  });
  fillCask(world, cask.id, {
    drink: recipe.drink,
    cups: def.cups,
    ready: world.tick + def.days * TICKS_PER_DAY,
    line,
  });
  takeFrom(world, load, load['count'] as number);
  return stop(p);
}
