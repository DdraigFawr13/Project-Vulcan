// The pasture (P5.4b, Phase 5 Bundle 3, V-041, V-049): the Build sheet's Pasture row says how much
// the colony wants one; nobody is told where. Each hour, while no pasture stands or is planned
// and a wild herd of a tameable species grazes the valley, the colony sites one (pasturesite.ts):
// a rectangle of wattle hurdles with a fold in an inside corner, a hay meadow and a rick. The
// hurdles are plans builders take up like any other; once all stand the pasture is built (the
// flock, src/engine/flock, takes it from there). A plan may be sent back once.
import { TICKS_PER_DAY } from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { layItem, marksOf, raiseStock } from '../goods/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { dirFrom, homeless, PASTURE_KIND, wantOf } from './houses.ts';
import { choosePasture, wildHerds } from './pasturesite.ts';
import { hurdleTiles, livePastures, pasturesOf } from './pasturerows.ts';
import { partOf, plansOf, refundOf } from './plans.ts';

export { PASTURE_KIND };

/** The plan rows of a pasture's hurdles. */
const hurdlesOf = (ctx: SystemContext, id: number) =>
  plansOf(ctx.world).filter((p) => p['house'] === id);

/** The plural words of the wild herds the colony would tame ("sheep", "sheep and goats"). */
function speciesWords(ctx: SystemContext): string {
  const { world, content } = ctx;
  const ids = [...new Set(wildHerds(world, content).map((h) => h['species'] as string))];
  const word = (id: string) =>
    (content.wild.species.find((s) => s.id === id)?.plural ?? id).replace(/^wild /, '');
  return ids.map(word).join(' and ');
}

/** Sites a pasture if none stands and a tameable wild herd grazes: said with the need first,
 * then the plan, or one alert while no open grass fits. `sent` marks a plan replacing one sent
 * back. */
export function planPasture(ctx: SystemContext, green: Spot, causes: number[], sent = 0): void {
  const { world, content, state } = ctx;
  if (livePastures(world).length || !wildHerds(world, content).length) return;
  // The colony's first care is a roof: the pasture waits until nobody sleeps in the open.
  if (homeless(world, content).length) return;
  if (!state['pastureNeed']) {
    const want = wantOf(world, content, PASTURE_KIND);
    state['pastureNeed'] = ctx.emit('pasture.needed', {
      causes: want.line ? [want.line] : [],
      data: { species: speciesWords(ctx) },
    });
  }
  // With no ground found, the colony looks again once a day.
  if (state['pastureNoGround'] && !sent && world.tick < state['pastureTried']! + TICKS_PER_DAY)
    return;
  state['pastureTried'] = world.tick;
  const site = choosePasture(world, content, green);
  if (!site) {
    state['pastureNoGround'] ||= ctx.emit('pasture.noGround', { causes: [state['pastureNeed']!] });
    return;
  }
  state['pastureNoGround'] = 0;
  const width = world.map.width;
  const def = content.flock.pasture;
  const kind = (
    content.wild.species.find((s) => s.id === site.herd['species'])?.plural ?? ''
  ).replace(/^wild /, '');
  const water = site.wet <= 1 ? 'beside water' : `${site.wet} tiles from water`;
  const n = site.trees.length;
  const felling = n ? `${n} tree${n > 1 ? 's' : ''} to fell first` : 'nothing to fell';
  const why = `open grass ${water}, ${site.far} tiles past the town ring, the nearest to the wild ${kind}; ${felling}`;
  const rect = { x: site.x, y: site.y, w: site.w, h: site.h };
  const line = ctx.emit('pasture.sited', {
    causes: [state['pastureNeed']!, ...causes].filter((l) => l > 0),
    data: { tiles: (def.w - 2) * (def.h - 2), dir: dirFrom(green, rect), why },
  });
  const id = addEntity(world, 'pasture', {
    ...{ x: site.x, y: site.y, w: site.w, h: site.h, corner: site.corner, fold: def.fold },
    ...{ gate: site.gate, foldGate: site.foldGate, mx: site.mx, my: site.my },
    ...{ mw: site.mw, mh: site.mh, rick: site.rick, state: 'plan', line, last: line },
    ...{ why, sent, at: (site.y + Math.floor(def.h / 2)) * width + site.x + Math.floor(def.w / 2) },
  });
  // Trees on the ground are felled first, as on a house's site.
  for (const i of site.trees)
    addEntity(world, 'mark', { x: i % width, y: Math.floor(i / width), line, house: id });
  const row = pasturesOf(world).find((p) => p.id === id)!;
  for (const { i, part } of hurdleTiles(content, width, row))
    addEntity(world, 'plan', {
      ...{ part, x: i % width, y: Math.floor(i / width), z: 0, have: 0, also: 0, work: -1 },
      ...{ state: 'plan', house: id, line, done: 0, waited: 0, shut: 0, held: 0 },
    });
  for (const good of new Set([def.hurdle, def.gate].map((p) => partOf(content, p)!.material)))
    raiseStock(ctx, good, def.name.toLowerCase(), line);
}

/** A planned pasture whose hurdles all stand is built (`pasture.built`, citing the sited line
 * and the last hurdle). */
export function finishPastures(ctx: SystemContext): void {
  for (const p of livePastures(ctx.world).filter((r) => r['state'] === 'plan')) {
    const plans = hurdlesOf(ctx, p.id);
    if (!plans.length || plans.some((q) => q['state'] !== 'built')) continue;
    p['state'] = 'built';
    p['last'] = ctx.emit('pasture.built', {
      causes: [p['line'] as number, Math.max(...plans.map((q) => q['done'] as number))],
      data: { holds: ctx.content.flock.pasture.holds },
    });
  }
}

/** The `sendBack {pasture}` lever (V-049): a pasture still planned, with no hurdle built and not
 * itself a replacement, is dropped; what was brought is laid back, its ground is never chosen
 * again and the colony chooses again at once. */
export function sendBackPasture(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
  green: Spot,
): void {
  const { world, content } = ctx;
  const p = pasturesOf(world).find((r) => r.id === data['pasture']);
  const plans = p ? hurdlesOf(ctx, p.id) : [];
  const why =
    !p || p['state'] !== 'plan'
      ? 'no such plan'
      : p['sent']
        ? 'it was sent back once already'
        : plans.some((q) => (q['done'] as number) > 0)
          ? 'building has begun'
          : undefined;
  if (why) {
    ctx.emit('command.refused', { causes: [cause], data: { kind: 'sendBack', reason: why } });
    return;
  }
  const line = ctx.emit('pasture.sentBack', { causes: [cause, p!['line'] as number] });
  for (const q of plans) {
    const at = { x: q['x'] as number, y: q['y'] as number, z: 0 };
    for (const { kind, count } of refundOf(content, q))
      if (count > 0) layItem(world, { kind, count, ...at, made: line });
    removeEntity(world, 'plan', q.id);
  }
  for (const m of marksOf(world).filter((m) => m['house'] === p!.id))
    removeEntity(world, 'mark', m.id);
  p!['state'] = 'sent';
  planPasture(ctx, green, [line], 1);
}
