// Smithing (Bundle 3, V-041, V-088): nobody orders a tool. Someone who has done tool work in the
// last week and has no tool of that kind, or one worse than the best metal with ingots in the
// store could make, is a want; the smith makes the want of whoever does that work most first. A
// free person able to smith, with a forge standing, goes to the store (ingots and charcoal are
// reached there), then works at the forge `minutes × 2 × skilled ÷ (skilled + level)` and lays the
// tool with the cart; its quality is their smithing level plus a roll of up to `roll` from the
// `craft` stream, worded as furniture is. Wants never pull ingots: with none to be had, one alert
// names the plates to raise.
import { streamFor, type EntityRow } from '../core/index.ts';
import { piecesOf, qualityOf } from '../build/index.ts';
import {
  inStore,
  itemsOf,
  layTool,
  mergeTrails,
  restOf,
  speedOf,
  takeFrom,
  toolOf,
  trailOf,
  trailText,
  withStep,
  type Step,
} from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { firstFine } from './fine.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { goBeside, people, same, skillOf, spotOf } from './spots.ts';
import { SMITHING } from './smithing.ts';
import { giveTool, heldSpeed, mostUsed } from './tools.ts';
import { walkTo } from './walk.ts';

const JOB = 'smith';

const forgeOf = (ctx: SystemContext) => piecesOf(ctx.world, 'forge')[0];

/** Free ingots/charcoal of an item kind lying in the store, nearest first. */
function stacks(ctx: SystemContext, kind: string, from?: { x: number; y: number }): EntityRow[] {
  const at = from ?? restOf(ctx.world, ctx.content);
  const dist = (i: EntityRow) =>
    Math.max(Math.abs((i['x'] as number) - at.x), Math.abs((i['y'] as number) - at.y));
  return itemsOf(ctx.world)
    .filter(
      (i) =>
        i['kind'] === kind &&
        !i['holder'] &&
        inStore(ctx.world, i['x'] as number, i['y'] as number, i['z'] as number),
    )
    .sort((a, b) => dist(a) - dist(b) || a.id - b.id);
}
const count = (list: EntityRow[]): number => list.reduce((n, i) => n + (i['count'] as number), 0);

export interface ToolWant {
  person: EntityRow;
  kind: string;
  /** The material to make it in: the best with ingots in the store; undefined when none. */
  material?: string;
}

/** The best material a tool of `kind` can be made of now from what the store holds. */
function makeable(ctx: SystemContext, kind: string): string | undefined {
  const { content } = ctx;
  const k = content.tools.kinds.find((t) => t.id === kind)!;
  const charcoal = count(stacks(ctx, content.tools.charcoal));
  return [...content.tools.materials]
    .filter((m) => m.ingot)
    .sort((a, b) => b.speed - a.speed)
    .find((m) => count(stacks(ctx, m.ingot!)) >= k.ingots && charcoal >= k.charcoal)?.id;
}

/** Who wants a tool now, whoever works longest at the kind first; ties by kind order, person id. */
export function toolWants(ctx: SystemContext): ToolWant[] {
  const { world, content } = ctx;
  const making = people(world)
    .filter((q) => q['job'] === JOB)
    .map((q) => `${q['plan']}:${String(q['making']).split(':')[0]}`);
  const out: (ToolWant & { minutes: number })[] = [];
  for (const kind of content.tools.kinds) {
    const material = makeable(ctx, kind.id);
    const best = material ? content.tools.materials.find((m) => m.id === material)!.speed : 0;
    for (const row of mostUsed(ctx, kind.id)) {
      const person = people(world).find((q) => q.id === row['person'])!;
      if (making.includes(`${person.id}:${kind.id}`)) continue;
      const free = itemsOf(world).find(
        (i) => toolOf(content, i)?.kind === kind.id && i['state'] !== 'held' && !i['holder'],
      );
      const have = Math.max(heldSpeed(ctx, person.id, kind.id), free ? speedOf(content, free) : 0);
      if (material ? have < best : have === 0)
        out.push({
          person,
          kind: kind.id,
          ...(material && { material }),
          minutes: row['minutes'] as number,
        });
    }
  }
  return out.sort((a, b) => b.minutes - a.minutes);
}

function stop(p: EntityRow): false {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, making: '', carry: '' });
  return false;
}

/** The plates to raise to have a tool made: the ingot plates of the materials, in words. */
function platesOf(ctx: SystemContext): string {
  const { content } = ctx;
  const names = content.tools.materials
    .filter((m) => m.ingot)
    .map(
      (m) =>
        content.work.stock.find((s) => s.good === m.ingot)?.name ??
        content.items.find((i) => i.id === m.ingot)!.name,
    );
  return names.join(' or ');
}

/** Takes up smithing the top tool want if a forge stands and nobody free who puts Smith higher
 * could; else says once that wants wait for ingots. */
export function takeUpSmithing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (!able(content, p, JOB)) {
    declineIfUnable(ctx, p, JOB);
    return false;
  }
  const forge = forgeOf(ctx);
  if (!forge) return false;
  const wants = toolWants(ctx);
  const want = wants.find((w) => w.material);
  if (!want) {
    const starved = wants[0];
    if (starved && !ctx.state['noIngots'])
      ctx.state['noIngots'] = ctx.emit('smith.noIngots', {
        causes: [forge['made'] as number].filter((l) => l > 0),
        actors: [starved.person.id],
        data: {
          who: starved.person['name'] as string,
          tool: content.tools.kinds.find((k) => k.id === starved.kind)!.name,
          plates: platesOf(ctx),
        },
      });
    return false;
  }
  ctx.state['noIngots'] = 0;
  if (outranked(ctx, p, JOB, () => true)) return false;
  const k = content.tools.kinds.find((t) => t.id === want.kind)!;
  const m = content.tools.materials.find((t) => t.id === want.material)!;
  const mine = want.person.id === p.id;
  p['took'] = ctx.emit('work.tookUpSmithing', {
    causes: [forge['made'] as number, priorityLine(world, p.id, JOB)].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: `${/^[aeiou]/.test(m.name) ? 'an' : 'a'} ${m.name} ${k.name}`,
      who: mine ? 'themself' : (want.person['name'] as string),
      why: heldSpeed(ctx, want.person.id, k.id)
        ? `a slower ${k.name} for the work ${mine ? 'they do' : (want.person['name'] as string) + ' does'} most`
        : `no ${k.name} for the work ${mine ? 'they do' : (want.person['name'] as string) + ' does'} most`,
    },
  });
  Object.assign(p, {
    job: JOB,
    plan: want.person.id,
    making: `${k.id}:${m.id}`,
    target: -1,
    work: -1,
  });
  return smithing(ctx, p);
}

/** One minute of smithing; false when it is done or cannot go on (they look for work again). */
export function smithing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const forge = forgeOf(ctx);
  const [kindId, materialId] = String(p['making']).split(':');
  const k = content.tools.kinds.find((t) => t.id === kindId);
  const m = content.tools.materials.find((t) => t.id === materialId);
  const target = people(world).find((q) => q.id === p['plan']);
  if (!forge || !k || !m?.ingot || !target || target['status'] !== 'alive') return stop(p);
  const at = spotOf(p);
  // First to the store, where the ingots and charcoal are reached.
  if ((p['target'] as number) === -1) {
    const ingots = stacks(ctx, m.ingot, at)[0];
    if (!ingots) return stop(p);
    if (!same(spotOf(ingots), at)) return walkTo(ctx, p, spotOf(ingots)) || stop(p);
    p['target'] = -2;
  }
  const [fx, fy] = [forge['x'] as number, forge['y'] as number];
  const beside = at.z === 0 && Math.abs(at.x - fx) + Math.abs(at.y - fy) === 1;
  if (!beside) return goBeside(ctx, p, fx, fy) || stop(p);
  const level = skillOf(world, p, SMITHING);
  if ((p['work'] as number) < 0) {
    const ingots = stacks(ctx, m.ingot, at);
    const charcoal = stacks(ctx, content.tools.charcoal, at);
    if (count(ingots) < k.ingots || count(charcoal) < k.charcoal) return stop(p);
    const trails: Step[][] = [];
    for (const [list, n] of [
      [ingots, k.ingots],
      [charcoal, k.charcoal],
    ] as const) {
      let left = n;
      for (const s of list) {
        if (left <= 0) break;
        trails.push(trailOf(s));
        left -= takeFrom(world, s, left);
      }
    }
    p['carry'] = trailText(
      withStep(mergeTrails(trails, 5), { s: 'made', who: p['name'] as string, tick: world.tick }),
    );
    const tools = content.tools;
    p['work'] = Math.max(1, Math.ceil((k.minutes * 2 * tools.skilled) / (tools.skilled + level)));
  }
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, SMITHING, p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  made(ctx, p, target, k.id, m.id, level);
  stop(p);
  return true;
}

/** The tool is made: a line, the tool lies with the cart, and whoever it is for takes it if it is
 * better than theirs. */
function made(
  ctx: SystemContext,
  p: EntityRow,
  target: EntityRow,
  kind: string,
  material: string,
  level: number,
) {
  const { world, content } = ctx;
  const t = content.tools;
  const score = level + streamFor(world, t.stream).between(-t.roll, t.roll);
  const word = qualityOf(content, score);
  const k = t.kinds.find((x) => x.id === kind)!;
  const m = t.materials.find((x) => x.id === material)!;
  const forge = forgeOf(ctx);
  const plain = word.id === 'plain' ? '' : `${word.word} `;
  const what = `${/^[aeiou]/.test(plain || m.name) ? 'an' : 'a'} ${plain}${m.name} ${k.name}`;
  const line = ctx.emit('smith.made', {
    causes: [p['took'] as number, forge?.['made'] as number].filter((l) => l > 0),
    actors: [...new Set([p.id, target.id])],
    data: {
      name: p['name'] as string,
      what,
      who: target.id === p.id ? 'themself' : (target['name'] as string),
    },
  });
  const item = layTool(world, content, restOf(world, content), {
    ...{ kind, material, quality: word.id, made: line },
    trail: p['carry'] as string,
  });
  firstFine(ctx, p, score, word.word, what, line);
  if (heldSpeed(ctx, target.id, kind) < speedOf(content, item))
    giveTool(ctx, item, target, 'it was made for them');
}
