// Bleeding and healing (P5.6, V-115), each hour for everyone hurt. Bleeding drains blood (a
// mortal wound bleeds fast whatever is done; a healer's binding brings bleeding down a step at
// once and another each hour, a rough one stops only slow bleeding) and at none they die. An
// open wound heals by the hour: fastest abed with a healer's daily dressing, slower up and about,
// undressed or only roughly bound. A deep or grave wound may fester in its first days (less
// often with daily dressing); a fever puts them to bed and may kill them. On healing, a lasting
// mark may stay (more often without a healer's care).
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { die } from './death.ts';
import {
  bodyOf,
  keepsDown,
  markFor,
  openWounds,
  partDef,
  personOf,
  pronouns,
  herbedNow,
  severityOf,
  stopFor,
  woundName,
  woundsOf,
  woundWords,
} from './wounds.ts';

/** The chance a day that comes to `total` per cent over `days` days, in millionths: found by
 * halving (no powers or logarithms in the engine, V-006). */
export function dailyChance(total: number, days: number): number {
  if (total <= 0) return 0;
  if (total >= 100) return 1_000_000;
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 40; k += 1) {
    const q = (lo + hi) / 2;
    let stay = 1;
    for (let d = 0; d < days; d += 1) stay *= 1 - q;
    if (1 - stay < total / 100) lo = q;
    else hi = q;
  }
  return Math.round(lo * 1_000_000);
}

const roll = (ctx: SystemContext, millionths: number): boolean =>
  ctx.rng().int(1_000_000) < millionths;

/** Lying down: hurt abed, or asleep where they lie. */
const lying = (p: EntityRow): boolean =>
  p['doing'] === 'hurt' || (p['doing'] === 'sleep' && !(p['path'] as number[]).length);

/** Dressed by a healer within `heal.dressEvery` hours. */
const dressed = (ctx: Pick<SystemContext, 'world' | 'content'>, w: EntityRow): boolean =>
  w['bound'] === 2 &&
  ctx.world.tick - (w['dressed'] as number) < ctx.content.health.heal.dressEvery * 60;

/** Hundredths of an hour healed this hour. */
function rateOf(ctx: SystemContext, p: EntityRow, w: EntityRow): number {
  const h = ctx.content.health.heal;
  if (w['fester'] === 1) return 0;
  if (severityOf(ctx.content, w).bleed === 0) return 100;
  const base = lying(p) ? h.bed : h.up;
  const care = w['bound'] === 2 ? (dressed(ctx, w) ? 100 : h.undressed) : h.rough;
  return Math.floor((base * care) / 100);
}

/** One hour's blood: what the open wounds drain, else some regained. True when they died. */
function bleed(ctx: SystemContext, p: EntityRow, wounds: EntityRow[]): boolean {
  const { content } = ctx;
  const b = content.health.blood;
  const body = bodyOf(ctx.world, p.id)!;
  const rate = (n: number) => (n >= 2 ? b.fast : n === 1 ? b.slow : 0);
  const loss = wounds.reduce((s, w) => s + rate(w['mortal'] ? 2 : (w['bleed'] as number)), 0);
  // The wound they would die of, chosen before this hour's binding slows the bleeding.
  const worst = wounds
    .filter((x) => x['mortal'] || (x['bleed'] as number) > 0)
    .sort((x, y) => (y['mortal'] as number) - (x['mortal'] as number) || x.id - y.id)[0];
  for (const w of wounds)
    if (w['bound'] === 2 && !w['mortal'] && (w['bleed'] as number) > 0)
      w['bleed'] = (w['bleed'] as number) - 1;
  body['blood'] = loss
    ? Math.max(0, (body['blood'] as number) - loss)
    : Math.min(b.full, (body['blood'] as number) + b.regain);
  if ((body['blood'] as number) > 0 || !worst) return false;
  const w = worst;
  const { they, them } = pronouns(p);
  const finder = personOf(ctx.world, body['finder'] as number);
  const healer = personOf(ctx.world, w['healer'] as number);
  const care = healer
    ? `, though ${healer['name']} bound it`
    : w['bound'] === 1
      ? `, bound only roughly${finder ? ` by ${finder['name']}` : ''}`
      : finder
        ? ''
        : `, before anyone found ${them}`;
  const cap = they.charAt(0).toUpperCase() + they.slice(1);
  die(ctx, p, `${cap} bled to death from ${woundWords(content, w, p)}${care}.`, [
    w['line'] as number,
    w['care'] as number,
  ]);
  return true;
}

/** The per cent chance a wound festers over its first days: the kind's own chances, else the
 * severity's, [with care, without]; `herbs.fester` per cent of it while herbed. */
export function festerChance(ctx: Pick<SystemContext, 'world' | 'content'>, w: EntityRow): number {
  const { world, content } = ctx;
  // A kind of wound may have its own chances (a bite festers more), for deep and grave ones.
  const own = content.health.wounds.find((d) => d.id === w['kind'])?.fester;
  const base = (own ?? severityOf(content, w).fester)?.[dressed(ctx, w) ? 0 : 1] ?? 0;
  return herbedNow(world, content, w)
    ? Math.floor((base * content.health.herbs.fester) / 100)
    : base;
}

/** Festering in a wound's first days, and the fever it brings; true when the fever killed. */
function fester(ctx: SystemContext, p: EntityRow, w: EntityRow): boolean {
  const { world, content } = ctx;
  const sev = severityOf(content, w);
  const f = content.health.fester;
  const age = world.tick - (w['at'] as number);
  // Once a day, at the hour of the wound.
  if (age <= 0 || age % TICKS_PER_DAY >= 60) return false;
  if (w['fester'] === 0 && sev.fester && age <= f.days * TICKS_PER_DAY) {
    const total = festerChance(ctx, w);
    if (!roll(ctx, dailyChance(total, f.days))) return false;
    w['fester'] = 1;
    w['feverEnd'] = world.tick + f.fever * TICKS_PER_DAY;
    w['fevered'] = ctx.emit('health.festered', {
      causes: [w['line'] as number, w['care'] as number].filter((c) => c > 0),
      actors: [p.id],
      data: { name: p['name'] as string, wound: woundName(content, w) },
    });
    return false;
  }
  if (w['fester'] !== 1) return false;
  if (world.tick >= (w['feverEnd'] as number)) {
    w['fester'] = 2;
    ctx.emit('health.feverBroke', {
      causes: [w['fevered'] as number],
      actors: [p.id],
      data: { name: p['name'] as string },
    });
    return false;
  }
  if (!roll(ctx, dailyChance(f.dies, f.fever))) return false;
  die(ctx, p, `The fever from ${woundWords(content, w, p)} took ${pronouns(p).them}.`, [
    w['fevered'] as number,
    w['line'] as number,
    w['care'] as number,
  ]);
  return true;
}

/** A wound healed: the line, and a lasting mark if one is rolled for it. */
function healed(ctx: SystemContext, p: EntityRow, w: EntityRow): void {
  const { world, content } = ctx;
  const sev = severityOf(content, w);
  w['state'] = 'healed';
  const def = markFor(content, w['part'] as string);
  const marked = !!def && !!sev.mark && ctx.rng().int(100) < sev.mark[w['healer'] ? 0 : 1]!;
  const part = partDef(content, w['part'] as string)?.name ?? '';
  const markName = def ? def.name.replace('{part}', part) : '';
  const line = ctx.emit('health.healed', {
    causes: [w['care'] as number, w['line'] as number].filter((c) => c > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      wound: woundName(content, w),
      mark: marked ? `, but left ${pronouns(p).them} with a ${markName}` : '',
    },
  });
  if (marked)
    addEntity(world, 'scar', { person: p.id, mark: def.id, part: w['part'] as string, line });
}

/** One hour for everyone hurt and alive. */
export function healHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  const hurt = new Set(
    woundsOf(world)
      .filter((w) => w['state'] === 'open')
      .map((w) => w['person']),
  );
  for (const p of world.entities['person'] ?? []) {
    if (p['status'] !== 'alive') continue;
    const body = bodyOf(world, p.id);
    if (!body) continue;
    const wounds = openWounds(world, p.id);
    if (!hurt.has(p.id) && body['blood'] === content.health.blood.full) {
      if (body['down']) standUp(p, body);
      continue;
    }
    if (bleed(ctx, p, wounds)) continue;
    let dead = false;
    for (const w of wounds) {
      if (fester(ctx, p, w)) {
        dead = true;
        break;
      }
      w['progress'] = (w['progress'] as number) + rateOf(ctx, p, w);
      if ((w['progress'] as number) >= severityOf(content, w).days * 24 * 100) healed(ctx, p, w);
    }
    if (dead) continue;
    const down =
      (body['blood'] as number) < content.health.blood.faint ||
      openWounds(world, p.id).some((w) => keepsDown(content, w));
    if (down && !body['down']) {
      body['down'] = 1;
      stopFor(ctx, p, true);
    } else if (!down && body['down']) standUp(p, body);
  }
}

/** Back on their feet: they leave the bed they were laid on and go about their day. */
function standUp(p: EntityRow, body: EntityRow): void {
  Object.assign(body, { down: 0, bed: 0, roll: 0, finder: 0, found: 0 });
  if (p['doing'] === 'hurt') p['doing'] = '';
}
