// Death and burial (P5.8, V-116). A death is one line citing every cause given (the wound, the
// care it had, the fever). The dead keep their row with status `dead`: what they carried is put
// down, their tools go back to the cart, their bed is free. Everyone grieves, the close (the
// same home, or the same house) the most. An unburied body unsettles anyone who passes it and is
// said after a day. A grave dug (people/burial.ts) is filled at the end of the working day with
// everyone free there, and the dead are `buried`.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { bedOwnedBy, houseAt, mainOf, roomName } from '../build/index.ts';
import { itemsOf, restOf, toolsChanged } from '../goods/index.ts';
import { addMemories, addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { bodyOf, ensureBody, openWounds, pronouns, stopFor, worstOf } from './wounds.ts';

const alive = (world: WorldState): EntityRow[] =>
  (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

const list = (names: readonly string[]): string =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** The main house a person sleeps in (their bed's or bedroll's), if any. */
function homeHouse(world: WorldState, content: EngineContent, p: EntityRow): number {
  const bed =
    bedOwnedBy(world, p.id) ??
    itemsOf(world).find(
      (i) =>
        i['owner'] === p.id && i['kind'] === content.life.cart.bedroll && i['state'] === 'laid',
    );
  const h = bed && houseAt(world, bed['x'] as number, bed['y'] as number);
  return h && h['state'] === 'built' ? mainOf(world, h).id : 0;
}

/** Where the hurt lie, in words: "the sickroom", "his bed in the cottage", "her bedroll". */
export function bedWords(world: WorldState, content: EngineContent, p: EntityRow): string {
  const body = bodyOf(world, p.id);
  const { their } = pronouns(p);
  if (!body?.['bed']) return '';
  if (body['roll']) return `${their} bedroll`;
  const bed = (world.entities['furniture'] ?? []).find((f) => f.id === body['bed']);
  const h = bed && houseAt(world, bed['x'] as number, bed['y'] as number);
  if (!bed || !h) return `${their} bed`;
  if (h['sick']) return 'the sickroom';
  const room = roomName(world, content, h);
  return bed['owner'] === p.id ? `${their} bed in the ${room}` : `a bed in the ${room}`;
}

/** Where someone is, for a line: abed ("in the sickroom"), else where their worst wound was
 * taken ("in the shaft"). */
export function whereWords(world: WorldState, content: EngineContent, p: EntityRow): string {
  const bed = bedWords(world, content, p);
  if (bed) return `in ${bed}`;
  const w = worstOf(content, openWounds(world, p.id));
  return w?.['where'] ? `${w['place']} the ${w['where']}` : `where ${pronouns(p).they} lay`;
}

/** `p` dies of `cause` (a sentence), citing `causes`. */
export function die(ctx: SystemContext, p: EntityRow, cause: string, causes: number[]): number {
  const { world, content } = ctx;
  const body = ensureBody(world, content, p);
  const where = whereWords(world, content, p);
  const close = homeHouse(world, content, p);
  const line = ctx.emit('health.died', {
    causes: [...new Set(causes.filter((c) => c > 0))].sort((a, b) => a - b),
    actors: [p.id],
    data: { name: p['name'] as string, where, cause },
  });
  stopFor(ctx, p, false);
  Object.assign(p, { status: 'dead', doing: '', path: [], stride: 0 });
  Object.assign(body, { died: line, diedAt: world.tick, down: 1, healer: 0, carrier: 0 });
  // Their tools go back to the cart; their bed is anyone's.
  const rest = restOf(world, content);
  for (const i of itemsOf(world))
    if (i['state'] === 'held' && i['owner'] === p.id)
      Object.assign(i, { owner: 0, state: '', ...rest });
  toolsChanged(world);
  const bed = bedOwnedBy(world, p.id);
  if (bed) bed['owner'] = 0;
  for (const w of openWounds(world, p.id)) w['state'] = 'closed';
  const m = content.health.mourn;
  for (const q of alive(world)) {
    const near =
      (!!p['home'] && q['home'] === p['home']) ||
      (!!close && homeHouse(world, content, q) === close);
    addMemory(ctx, q.id, near ? m.close : m.band, line, p.id);
  }
  return line;
}

/** Each hour: an unburied body unsettles the awake who pass within `mourn.near` tiles, and one
 * lying out `mourn.unburied` days is said once. */
export function unburiedHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  const m = content.health.mourn;
  for (const d of world.entities['person'] ?? []) {
    if (d['status'] !== 'dead') continue;
    const body = bodyOf(world, d.id);
    if (!body) continue;
    for (const q of alive(world)) {
      if (q['doing'] === 'sleep' || q['doing'] === 'hurt' || q['z'] !== d['z']) continue;
      const far = Math.max(
        Math.abs((q['x'] as number) - (d['x'] as number)),
        Math.abs((q['y'] as number) - (d['y'] as number)),
      );
      if (far <= m.near) addMemory(ctx, q.id, m.saw, body['died'] as number, d.id);
    }
    if (body['alerted'] || world.tick - (body['diedAt'] as number) < m.unburied * TICKS_PER_DAY)
      continue;
    body['alerted'] = 1;
    ctx.emit('health.unburied', {
      causes: [body['died'] as number],
      actors: [d.id],
      data: { name: d['name'] as string },
    });
  }
}

/** At the end of the working day each dug grave is filled: the dead are buried with everyone
 * free there, who mourn them together. */
export function buryAtDayEnd(ctx: SystemContext, hour: number): void {
  const { world, content } = ctx;
  if (hour !== content.work.hours.to) return;
  for (const g of world.entities['grave'] ?? []) {
    if (g['state'] !== 'dug') continue;
    const d = (world.entities['person'] ?? []).find((p) => p.id === g['person']);
    const body = d && bodyOf(world, d.id);
    if (!d || !body) continue;
    const there = alive(world).filter((q) => !bodyOf(world, q.id)?.['down']);
    const by = there.find((q) => q.id === g['by']) ?? there[0];
    const line = ctx.emit('health.buried', {
      causes: [body['died'] as number, g['line'] as number].filter((c) => c > 0),
      actors: [d.id, ...there.map((q) => q.id)],
      data: {
        name: d['name'] as string,
        by: (by?.['name'] as string) ?? 'the band',
        mourners: there.length ? list(there.map((q) => q['name'] as string)) : 'Nobody',
        them: pronouns(d).them,
      },
    });
    addMemories(
      ctx,
      there.map((q) => q.id),
      content.health.mourn.burial,
      line,
      d.id,
    );
    Object.assign(g, { state: 'filled', buried: line });
    Object.assign(d, { status: 'buried', x: g['x'], y: g['y'], z: 0 });
    body['carrier'] = 0;
  }
}
