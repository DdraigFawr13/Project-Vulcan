// The lord comes himself (6C Slice 7 part 2, V-236, V-240): every `visit.every`th harvest home he
// rides in with the reeve and a few of his men as soon as the colony calls the supper, sits at it,
// stays the night and leaves after the reeve has taken the tithe in the morning. The Feasts law sets
// how grand his table is (and what it costs the store); what pleases him follows his temper; each
// is a favour cause with its line; the winner of the contest held for him takes his prize (part 3,
// V-241). Nobody is sent to meet him and no lever moves him (V-041).
import { list, TICKS_PER_DAY, TICKS_PER_HOUR, today, type EntityRow } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import type { Spot } from '../paths/index.ts';
import { feastOf } from '../build/index.ts';
import { foodDays, itemsOf, layTool, restOf, takeFrom } from '../goods/index.ts';
import { giveTool, walkTo } from '../band/index.ts';
import { contestsAt } from '../contest/index.ts';
import { kegsOf } from '../inn/index.ts';
import { settingOf } from '../law/index.ts';
import { creedsOf, shrineOf } from '../faith/index.ts';
import { keptBooks } from '../teach/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addFavour, favourOf } from './favour.ts';
import { hothead } from './hothead.ts';
import { lordName, lordRow, pronounsOf } from './tables.ts';

/** Whether the coming harvest home is one the lord comes to himself: the `every`th, counting the
 * one he was named at as the first. */
export function lordsYear(ctx: SystemContext): boolean {
  const lord = lordRow(ctx.world);
  if (!lord?.['named']) return false;
  const homes = ((lord['visits'] as number) || 0) + 2;
  return homes % ctx.content.lord.visit.every === 0;
}

/** The harvest-home supper called for tonight and not yet eaten, after feast row `done`. */
function supperTonight(ctx: SystemContext): EntityRow | undefined {
  const f = feastOf(ctx.world);
  const harvest = f && !(f['couple'] as number[]).length && !f['holy'];
  return harvest && f.id > (ctx.state['done'] ?? 0) ? f : undefined;
}

/** In a lord's year, when the supper is called: he rides in with the reeve and his men, to stay
 * until the next morning's count. True when he came (or this supper was let go). */
export function lordComes(
  ctx: SystemContext,
  send: (causes: readonly number[]) => EntityRow | undefined,
  hall: () => Spot,
): boolean {
  const f = supperTonight(ctx);
  if (!f || !lordsYear(ctx)) return false;
  ctx.state['done'] = f.id;
  const lord = lordRow(ctx.world)!;
  const r = send([f['line'] as number]);
  if (!r) return true;
  const first = !(lord['came'] as number);
  const men = ctx.content.lord.visit.men;
  const line = ctx.emit('lord.came', {
    causes: [f['line'] as number],
    data: {
      ...{ lord: lordName(lord), dir: lord['dir'] as string, reeve: lord['reeve'] as string },
      ...{ men: String(men), his: pronounsOf(lord).his },
      first: first ? ` ${pronounsOf(lord).He} has not come before.` : '',
    },
  });
  lord['came'] = line;
  const next = (today(ctx.world) + 1) * TICKS_PER_DAY;
  Object.assign(r, {
    lord: line,
    came: line,
    feast: f.id,
    wait: next + ctx.content.lord.reeve.arrive * TICKS_PER_HOUR,
  });
  r['favourIn'] = favourOf(ctx);
  walkTo(ctx, r, hall());
  return true;
}

/** The best food free to take, best first: cooked, then the most filling. */
function tableFood(ctx: SystemContext): EntityRow[] {
  const { content } = ctx;
  const worth = content.life.eat;
  const cooked = (i: EntityRow) => (content.items.find((d) => d.id === i['kind'])?.cooked ? 1 : 0);
  return itemsOf(ctx.world)
    .filter(
      (i) =>
        !i['holder'] &&
        !i['state'] &&
        worth[i['kind'] as string] !== undefined &&
        !content.life.lastResort.includes(i['kind'] as string),
    )
    .sort(
      (a, b) =>
        cooked(b) - cooked(a) ||
        worth[b['kind'] as string]! - worth[a['kind'] as string]! ||
        a.id - b.id,
    );
}

/** Lays `n` portions from the store; the names of what was laid, in order. */
function lay(ctx: SystemContext, n: number): { names: string[]; laid: number } {
  const names: string[] = [];
  let laid = 0;
  for (const i of tableFood(ctx)) {
    if (laid >= n) break;
    const name = ctx.content.items.find((d) => d.id === i['kind'])?.name ?? (i['kind'] as string);
    const got = takeFrom(ctx.world, i, n - laid);
    if (got > 0 && !names.includes(name.toLowerCase())) names.push(name.toLowerCase());
    laid += got;
  }
  return { names, laid };
}

/** Pours up to `n` cups from the ready casks; how many were poured. */
function pour(ctx: SystemContext, n: number): number {
  let poured = 0;
  for (const k of kegsOf(ctx.world)) {
    if (poured >= n || (k['ready'] as number) > ctx.world.tick) continue;
    const cups = Math.min(n - poured, k['cups'] as number);
    k['cups'] = (k['cups'] as number) - cups;
    poured += cups;
  }
  return poured;
}

/** Whether what pleases a lord of his temper is there at supper `f`: a contest held at it, the
 * Many table, a built shrine, a kept book, a store over the lean mark. */
function pleased(ctx: SystemContext, wants: string, f: EntityRow): boolean | undefined {
  const { world, content } = ctx;
  if (wants === 'contest') return contestsAt(world, f.id).length > 0;
  if (wants === 'table') return settingOf(world, content, 'feasts').id === 'many';
  if (wants === 'rite')
    return creedsOf(world).some((c) => shrineOf(world, c)?.['state'] === 'built');
  if (wants === 'book') return keptBooks(world).length > 0;
  if (wants === 'store')
    return foodDays(world, content, alive(world).length).days >= content.lord.tithe.lean.days;
  return undefined;
}

/** The winner of the contest held for him takes a fine iron tool from his hand (`visit.prize`,
 * the contest's `prize` kind). */
function prize(ctx: SystemContext, f: EntityRow, cause: number): void {
  const { world, content } = ctx;
  const his = contestsAt(world, f.id).find((c) => c['lord']);
  const k = his && content.contests.kinds.find((x) => x.id === his['kind']);
  const p = his && alive(world).find((q) => q.id === his['winner']);
  const { material, quality } = content.lord.visit.prize;
  const tool = content.tools.kinds.find((t) => t.id === k?.prize);
  const metal = content.tools.materials.find((m) => m.id === material);
  if (!k || !p || !tool || !metal) return;
  const lord = lordRow(world)!;
  const line = ctx.emit('lord.prize', {
    causes: [his['line'] as number, cause],
    actors: [p.id],
    data: {
      ...{ lord: lordName(lord), name: p['name'] as string, contest: k.name },
      ...{ what: `${/^[aeiou]/.test(quality) ? 'an' : 'a'} ${quality} ${metal.name} ${tool.name}` },
      his: pronounsOf(lord).his,
    },
  });
  const item = layTool(world, content, restOf(world, content), {
    ...{ kind: k.prize, material, quality, made: line },
  });
  giveTool(ctx, item, p, "it was the lord's prize");
}

/** The table laid for him: what the Feasts law asks over the supper itself, for those who ate
 * and his party; his favour for it and for what pleases him; then a hothead may speak. */
function judge(ctx: SystemContext, r: EntityRow, f: EntityRow): void {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const v = content.lord.visit;
  const setting = settingOf(world, content, 'feasts');
  const t = v.table[setting.id] ?? { extra: 0, ale: 0 };
  const there = ((f['there'] as number[]) ?? []).filter((id) =>
    alive(world).some((p) => p.id === id),
  );
  const party = 2 + v.men;
  // What pleases him is judged as he finds the valley, before his own table is laid.
  const p = v.pleases[lord['temper'] as string];
  const yes = p && pleased(ctx, p.wants, f);
  const food = lay(ctx, there.length * t.extra + party * (1 + t.extra));
  const cups = t.ale ? pour(ctx, (there.length + party) * t.ale) : 0;
  const laid = [...food.names, ...(cups ? ['ale'] : [])];
  const line = ctx.emit('lord.supper', {
    causes: [f['eaten'] as number, f['line'] as number, r['lord'] as number].filter((c) => c > 0),
    actors: there,
    data: {
      ...{ lord: lordName(lord), where: f['eaten'] ? 'with the valley' : 'alone with his men' },
      ...{ setting: setting.name, count: String(there.length), his: pronounsOf(lord).his },
      laid: laid.length
        ? `${food.laid} portions of ${list(laid)}${cups ? ` (${cups} cups)` : ''}`
        : 'nothing, for the store was bare',
    },
  });
  addFavour(ctx, `table-${setting.id}`, [line]);
  if (p && yes !== undefined)
    addFavour(ctx, yes ? 'pleased' : 'displeased', [line], { what: yes ? p.yes : p.no });
  prize(ctx, f, line);
  hothead(ctx, there, line);
}

/** One minute of the lord's stay before the morning's count: the supper judged once eaten (or let
 * go), the party waiting by the hall. False once it is time for the reeve to speak. */
export function stayMinute(ctx: SystemContext, r: EntityRow): boolean {
  const { world } = ctx;
  if (!r['judged']) {
    const f = (world.entities['feast'] ?? []).find((x) => x.id === r['feast']);
    if (!f || f['state'] === 'eaten' || today(world) > (f['on'] as number)) {
      r['judged'] = 1;
      if (f) judge(ctx, r, f);
    }
  }
  return world.tick < (r['wait'] as number);
}

/** As he leaves with the reeve: his favour then against when he came. */
export function rideOut(ctx: SystemContext, r: EntityRow): void {
  const lord = lordRow(ctx.world)!;
  const was = r['favourIn'] as number;
  const now = favourOf(ctx);
  const way =
    now > was
      ? `rose from ${was} to ${now}`
      : now < was
        ? `fell from ${was} to ${now}`
        : `stayed at ${now}`;
  ctx.emit('lord.rodeOut', {
    causes: [r['lord'] as number],
    data: {
      ...{ lord: lordName(lord), reeve: lord['reeve'] as string, way },
      ...{ his: pronounsOf(lord).his, His: pronounsOf(lord).His },
    },
  });
}
