// Smithing (Bundle 3, V-041, V-088): nobody orders a tool. Someone who has done tool work in the
// last week and has no tool of that kind, or one worse than the best metal with ingots in the
// store could make (a better material, whatever the quality), is a want; the smith makes the want
// of whoever does that work most first, one smith at a time. A free person able to smith, with a
// forge standing, goes to the store (ingots and charcoal are reached there), then works at the
// forge `minutes × 2 × skilled ÷ (skilled + level)`; when the tool is finished the inputs leave
// the store and the tool lies with the cart. Its quality is their smithing level plus a roll of up
// to `roll` from the `craft` stream, worded as furniture is. Wants never pull ingots: with none
// to be had, or with no charcoal, one alert says what is lacking. Open wants also count towards
// the charcoal the clamp burns (`toolCharcoal`).
import { streamFor, type EntityRow } from '../core/index.ts';
import { piecesOf, qualityOf } from '../build/index.ts';
import {
  freeTools,
  inStore,
  itemsOf,
  layTool,
  memoTools,
  mergeTrails,
  restOf,
  speedOf,
  takeFrom,
  trailOf,
  trailText,
  withStep,
  type Step,
} from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { firstFine } from './fine.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { canStandBeside, goBeside, people, same, skillOf, spotOf } from './spots.ts';
import { giveTool, heldMaterial, heldSpeed, materialSpeed, mostUsed } from './tools.ts';
import { walkTo } from './walk.ts';

const JOB = 'smith';

/** The smith job (tools.json `job`): its workplace is the forge piece, its skill what they practise. */
const jobOf = (ctx: SystemContext) => ctx.content.jobs.find((j) => j.id === ctx.content.tools.job)!;
const forgeOf = (ctx: SystemContext) => piecesOf(ctx.world, jobOf(ctx).workplace ?? '')[0];

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

/** The best material a tool of `kind` can be made of now from the ingots the store holds
 * (charcoal is burned for it, not required to be on hand). */
function makeable(ctx: SystemContext, kind: string): string | undefined {
  const { content } = ctx;
  const k = content.tools.kinds.find((t) => t.id === kind)!;
  return [...content.tools.materials]
    .filter((m) => m.ingot)
    .sort((a, b) => b.speed - a.speed)
    .find((m) => count(stacks(ctx, m.ingot!)) >= k.ingots)?.id;
}

/** Who wants a tool now, whoever works longest at the kind first; ties by kind order, person id.
 * A want is no tool of the kind held or free, or only a lower material than the best the store's
 * ingots could make (a poor tool of that material is not made again). Those being made now are
 * left out unless `all`. Worked out once until the tick, a line or a tool changes (every person
 * asks each minute). */
export const toolWants = (ctx: SystemContext, all = false): ToolWant[] =>
  memoTools(ctx.world, ctx.content, all ? 'wants:all' : 'wants', () => wantsNow(ctx, all));

function wantsNow(ctx: SystemContext, all: boolean): ToolWant[] {
  const { world, content } = ctx;
  const making = people(world)
    .filter((q) => q['job'] === JOB)
    .map((q) => `${q['plan']}:${String(q['making']).split(':')[0]}`);
  const out: (ToolWant & { minutes: number })[] = [];
  for (const kind of content.tools.kinds) {
    const material = makeable(ctx, kind.id);
    const best = material ? content.tools.materials.find((m) => m.id === material)!.speed : 0;
    const free = freeTools(world, content, kind.id)[0];
    for (const row of mostUsed(ctx, kind.id)) {
      const person = people(world).find((q) => q.id === row['person'])!;
      if (!all && making.includes(`${person.id}:${kind.id}`)) continue;
      const have = Math.max(
        heldMaterial(ctx, person.id, kind.id),
        free ? materialSpeed(content, free) : 0,
      );
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

/** Charcoal the open tool wants that have ingots would burn (the clamp's burner counts it). */
export const toolCharcoal = (ctx: SystemContext): number =>
  toolWants(ctx, true)
    .filter((w) => w.material)
    .reduce((n, w) => n + ctx.content.tools.kinds.find((k) => k.id === w.kind)!.charcoal, 0);

function stop(p: EntityRow): false {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, making: '' });
  return false;
}

/** The names of the ingot materials, e.g. "bronze or iron", and the plates that hold their ingots. */
function ingotWords(ctx: SystemContext): { metals: string; plates: string } {
  const { content } = ctx;
  const ingots = content.tools.materials.filter((m) => m.ingot);
  const plate = (ingot: string) =>
    content.work.stock.find((s) => s.good === ingot)?.name ??
    content.items.find((i) => i.id === ingot)!.name;
  return {
    metals: ingots.map((m) => m.name).join(' or '),
    plates: ingots.map((m) => plate(m.ingot!)).join(' or '),
  };
}

/** Says once, until it changes, what a tool want lacks: `key` is the state that holds the line. */
function lacking(
  ctx: SystemContext,
  key: 'noIngots' | 'noCharcoal',
  forge: EntityRow,
  w: ToolWant,
  lack: string,
  fix: string,
): void {
  if (ctx.state[key]) return;
  ctx.state[key] = ctx.emit('smith.noIngots', {
    causes: [forge['made'] as number].filter((l) => l > 0),
    actors: [w.person.id],
    data: {
      who: w.person['name'] as string,
      tool: ctx.content.tools.kinds.find((k) => k.id === w.kind)!.name,
      lack,
      fix,
    },
  });
}

/** Takes up smithing the top tool want if a forge stands and nobody free who puts Smith higher
 * could; else says once that wants wait for ingots or for charcoal. */
export function takeUpSmithing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content, state } = ctx;
  const job = content.tools.job;
  if (!able(content, p, job)) {
    declineIfUnable(ctx, p, job);
    return false;
  }
  const forge = forgeOf(ctx);
  if (!forge) return false;
  const wants = toolWants(ctx);
  const want = wants.find((w) => w.material);
  if (!wants.length) Object.assign(state, { noIngots: 0, noCharcoal: 0 });
  if (!want) {
    state['noCharcoal'] = 0;
    const { metals, plates } = ingotWords(ctx);
    if (wants[0])
      lacking(
        ctx,
        'noIngots',
        forge,
        wants[0],
        `${metals} ingots`,
        `raise the ${plates} plate to have one made`,
      );
    return false;
  }
  state['noIngots'] = 0;
  const k = content.tools.kinds.find((t) => t.id === want.kind)!;
  if (count(stacks(ctx, content.tools.charcoal)) < k.charcoal) {
    // The clamp burns charcoal for open wants (charcoal.ts); this says it is being waited for.
    const name = content.items.find((i) => i.id === content.tools.charcoal)!.name;
    lacking(ctx, 'noCharcoal', forge, want, name, `the clamp must burn some`);
    return false;
  }
  state['noCharcoal'] = 0;
  if (people(world).some((q) => q.id !== p.id && q['job'] === JOB)) return false;
  if (outranked(ctx, p, job, () => true)) return false;
  if (!canStandBeside(ctx, p, forge['x'] as number, forge['y'] as number)) return false;
  const m = content.tools.materials.find((t) => t.id === want.material)!;
  const mine = want.person.id === p.id;
  p['took'] = ctx.emit('work.tookUpSmithing', {
    causes: [forge['made'] as number, priorityLine(world, p.id, job)].filter(
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
  const level = skillOf(world, p, skillName(ctx));
  if ((p['work'] as number) < 0) {
    const tools = content.tools;
    p['work'] = Math.max(1, Math.ceil((k.minutes * 2 * tools.skilled) / (tools.skilled + level)));
  }
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(ctx), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  // The tool is finished: only now do its ingots and charcoal leave the store.
  const ingots = stacks(ctx, m.ingot, at);
  const charcoal = stacks(ctx, content.tools.charcoal, at);
  if (count(ingots) < k.ingots || count(charcoal) < k.charcoal) return stop(p);
  const most = content.metal.trail.most;
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
  const step: Step = { s: 'made', who: p['name'] as string, tick: world.tick };
  const trail = trailText(withStep(mergeTrails(trails, most), step, most));
  made(ctx, p, target, { kind: k.id, material: m.id, level, trail });
  stop(p);
  return true;
}

const skillName = (ctx: SystemContext): string => jobOf(ctx).skill ?? '';

/** The tool is made: a line, the tool lies with the cart, and whoever it is for takes it if it is
 * better than theirs. */
function made(
  ctx: SystemContext,
  p: EntityRow,
  target: EntityRow,
  tool: { kind: string; material: string; level: number; trail: string },
) {
  const { world, content } = ctx;
  const t = content.tools;
  const score = tool.level + streamFor(world, t.stream).between(-t.roll, t.roll);
  const word = qualityOf(content, score);
  const k = t.kinds.find((x) => x.id === tool.kind)!;
  const m = t.materials.find((x) => x.id === tool.material)!;
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
    ...{ kind: tool.kind, material: tool.material, quality: word.id, made: line },
    trail: tool.trail,
  });
  firstFine(ctx, p, score, word.word, what, line);
  if (heldSpeed(ctx, target.id, tool.kind) < speedOf(content, item))
    giveTool(ctx, item, target, 'it was made for them');
}
