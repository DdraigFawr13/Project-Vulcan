// The shrine and its priest (6B Bundle 4, P6.8, V-050, V-187). The faithful raise a shrine once
// `shrine.least` living people hold a faith and the colony has had its first reason to gather: the
// first death, wedding or harvest home, whichever came first. They site it on or beside the green,
// nearest the first hearth (by water for a faith that wants it, if any is near), and the builders
// make it like any builders' piece; it is never on the Build sheet (V-183, V-041). The most devout
// grown holder keeps it under the faith's title; when they die the next takes it up, with a line.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { furnitureKind, furnitureOf, HEARTH, openGround, wellsOf } from '../build/index.ts';
import { grown } from '../family/index.ts';
import { raiseStock } from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fill, nameOf, creedsOf, faithOf, faithWords, holdersOf, shrineOf } from './tables.ts';

/** The colony's first reason to gather, if it has had one: the earliest of the first death, the
 * first wedding and the first harvest home, with the line and the words for why. */
function firstReason(
  world: WorldState,
  content: EngineContent,
): { line: number; why: string } | undefined {
  const why = content.worship.why;
  const reasons: { line: number; why: string }[] = [];
  const died = (world.entities['body'] ?? [])
    .filter((b) => (b['died'] as number) > 0)
    .sort((a, b) => (a['died'] as number) - (b['died'] as number))[0];
  if (died)
    reasons.push({
      line: died['died'] as number,
      why: fill(why.death, { about: nameOf(world, died['person'] as number) }),
    });
  const wed = (world.entities['bond'] ?? [])
    .filter((b) => b['state'] === 'wed')
    .sort((a, b) => (a['line'] as number) - (b['line'] as number))[0];
  if (wed)
    reasons.push({
      line: wed['line'] as number,
      why: fill(why.wedding, {
        about: nameOf(world, wed['a'] as number),
        other: nameOf(world, wed['b'] as number),
      }),
    });
  const home = (world.entities['feast'] ?? [])
    .filter((f) => (f['eaten'] as number) > 0 && !(f['couple'] as number[]).length && !f['holy'])
    .sort((a, b) => (a['eaten'] as number) - (b['eaten'] as number))[0];
  if (home) reasons.push({ line: home['eaten'] as number, why: why.harvest });
  return reasons.sort((a, b) => a.line - b.line)[0];
}

/** Whether tile `x`, `y` lies beside drinkable water or a well. */
function byWater(world: WorldState, content: EngineContent, x: number, y: number): boolean {
  const map = world.map;
  for (let dy = -1; dy <= 1; dy += 1)
    for (let dx = -1; dx <= 1; dx += 1) {
      const [i, j] = [x + dx, y + dy];
      if (i < 0 || j < 0 || i >= map.width || j >= map.height) continue;
      if (content.terrain.kinds[map.tiles[j * map.width + i]!]!.drinkable) return true;
      if (wellsOf(world).some((w) => w['x'] === i && w['y'] === j)) return true;
    }
  return false;
}

/** The open tile nearest the first hearth (else the green) within `shrine.near`, reachable from
 * the green; by water first when the faith wants it. */
function siteOf(
  world: WorldState,
  content: EngineContent,
  green: Spot,
  water: boolean,
): Spot | undefined {
  const hearth = furnitureOf(world)
    .filter((f) => f['kind'] === HEARTH)
    .sort((a, b) => a.id - b.id)[0];
  const c = hearth ? { x: hearth['x'] as number, y: hearth['y'] as number } : green;
  const near = content.worship.shrine.near;
  const passes = water ? [true, false] : [false];
  for (const wet of passes)
    for (let r = 1; r <= near; r += 1)
      for (let dy = -r; dy <= r; dy += 1)
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const [x, y] = [c.x + dx, c.y + dy];
          if (wet && !byWater(world, content, x, y)) continue;
          if (
            openGround(world, content, x, y) &&
            canReach(content, world.map, green, { x, y, z: 0 })
          )
            return { x, y, z: 0 };
        }
  return undefined;
}

/** Once a day: a creed with enough holders and no shrine raises one, given a reason to gather. */
export function raiseShrines(ctx: SystemContext, green: Spot): void {
  const { world, content, state } = ctx;
  const day = Math.floor(world.tick / TICKS_PER_DAY);
  if (state['shrineDay'] === day + 1) return;
  state['shrineDay'] = day + 1;
  const reason = firstReason(world, content);
  if (!reason) return;
  for (const creed of creedsOf(world)) {
    if (creed['shrine']) continue;
    const holders = holdersOf(world, creed.id);
    if (holders.length < content.worship.shrine.least) continue;
    const kind = content.buildings.furniture.kinds.find((k) => k.id === creed['kind']);
    if (!kind) continue;
    const water = !!content.worship.shrine.faiths[creed['faith'] as string]?.water;
    const at = siteOf(world, content, green, water);
    if (!at) continue;
    // The first shrine rises for the colony's first reason; a later faith's for its own people.
    const first = !creedsOf(world).some((c) => c['shrine']);
    const names = holders.map((p) => p['name'] as string);
    const why = first
      ? reason.why
      : fill(content.worship.why.shared, {
          names: `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}`,
        });
    const causes = first ? [reason.line] : holders.map((p) => p['arrived'] as number);
    const line = ctx.emit('faith.shrine', {
      causes: causes.filter((l) => l > 0),
      actors: holders.map((p) => p.id),
      data: {
        faith: faithWords(creed),
        a: /^[aeiou]/.test(kind.name) ? 'an' : 'a',
        shrine: kind.name,
        why,
      },
    });
    const piece = addEntity(world, 'furniture', {
      ...{ kind: kind.id, x: at.x, y: at.y, z: 0, facing: 's', quality: 0, maker: 0 },
      ...{ owner: 0, made: 0, line, state: 'plan', have: 0, work: -1, waited: 0 },
    });
    Object.assign(creed, { shrine: piece, line });
    raiseStock(ctx, kind.material ?? content.buildings.furniture.material, kind.name, line);
    if (kind.also) raiseStock(ctx, kind.also.material, kind.name, line);
  }
}

/** The last stroke: the shrine stands (the builder's line cites their taking it up and the plan). */
export function shrineBuilt(ctx: SystemContext, p: EntityRow, piece: EntityRow): void {
  const creed = creedsOf(ctx.world).find((c) => c['shrine'] === piece.id);
  const made = ctx.emit('faith.shrineBuilt', {
    causes: [p['took'] as number, piece['line'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      shrine: furnitureKind(ctx.content, piece).name,
      faith: creed ? faithWords(creed) : 'the faithful',
    },
  });
  Object.assign(piece, { state: 'built', maker: p.id, made, work: 0, waited: 0 });
}

/** The most devout grown holder of a creed, the eldest then the first come on a tie. */
function mostDevout(
  world: WorldState,
  content: EngineContent,
  creed: number,
): EntityRow | undefined {
  const dev = (p: EntityRow) => (faithOf(world, p.id)?.['devotion'] as number) ?? 0;
  return holdersOf(world, creed)
    .filter((p) => grown(world, content, p))
    .sort(
      (a, b) => dev(b) - dev(a) || (a['born'] as number) - (b['born'] as number) || a.id - b.id,
    )[0];
}

/** Each hour: a creed with a shrine and no living priest gets the most devout as its priest. */
export function namePriests(ctx: SystemContext): void {
  const { world, content } = ctx;
  for (const creed of creedsOf(world)) {
    if (!creed['shrine']) continue;
    const old = (world.entities['person'] ?? []).find((p) => p.id === creed['priest']);
    if (old && old['status'] === 'alive') continue;
    const next = mostDevout(world, content, creed.id);
    if (!next) continue;
    const died = old && (world.entities['body'] ?? []).find((b) => b['person'] === old.id);
    const shrine = shrineOf(world, creed);
    const kind = shrine && furnitureKind(content, shrine);
    const named = ctx.emit('faith.priest', {
      causes: [(died?.['died'] as number) || (creed['line'] as number)].filter((l) => l > 0),
      actors: [next.id],
      data: {
        name: next['name'] as string,
        shrine: kind?.name ?? 'shrine',
        title: creed['title'] as string,
        faith: faithWords(creed),
        after: old ? `, after ${old['name'] as string}` : '',
      },
    });
    Object.assign(creed, { priest: next.id, named });
  }
}
