// Making a hearth (P3.6, V-041, V-049): the colony plans hearths (build/hearths.ts); builders make
// them, so a hearth is a row of the Work sheet's Building kind. A free person able to build takes
// up the nearest planned hearth they can fetch stone for and works it where it stands, through the
// same making flow as furniture (carpentry.ts `furnishing`), with the job word `hearth` on them.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { furnitureKind, furnitureLacks, furnitureOf, HEARTH, WELL } from '../build/index.ts';
import { firesOf, pieceOfFire, placeOf, reachOf } from '../fire/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { stackOf } from './build.ts';
import { furnishing } from './carpentry.ts';
import { able, outranked, priorityLine } from './priority.ts';
import { people, spotOf } from './spots.ts';

/** The planned hearths nobody is making, nearest `p` first, that have their stone or can get it. */
function openHearths(ctx: SystemContext, p: EntityRow): EntityRow[] {
  const { world, content } = ctx;
  const on = new Set(
    people(world)
      .filter((q) => q.id !== p.id && q['job'] === 'hearth')
      .map((q) => q['plan']),
  );
  const from = spotOf(p);
  const far = (f: EntityRow) =>
    Math.max(Math.abs((f['x'] as number) - from.x), Math.abs((f['y'] as number) - from.y));
  return furnitureOf(world)
    .filter((f) => {
      if (f['state'] !== 'plan' || on.has(f.id)) return false;
      const kind = furnitureKind(content, f);
      return kind.job === content.buildings.job;
    })
    .sort((a, b) => far(a) - far(b) || a.id - b.id);
}

/** The hearth `p` would make: the nearest whose stone is in hand or can be reached. */
function choose(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  return openHearths(ctx, p).find((f) => {
    const lack = furnitureLacks(ctx.content, furnitureKind(ctx.content, f), f['have'] as number);
    return lack.need === 0 || !!stackOf(ctx, p, lack.material);
  });
}

/** Takes up making a hearth if one is planned and nobody free who puts Building higher could. */
export function takeUpHearth(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const job = content.buildings.job;
  if (!able(content, p, job) || outranked(ctx, p, job, (q) => choose(ctx, q) !== undefined))
    return false;
  const piece = choose(ctx, p);
  if (!piece) {
    // A planned hearth whose stone cannot be reached is said once, until some is brought.
    const stuck = openHearths(ctx, p)[0];
    if (stuck && !stuck['waited'])
      stuck['waited'] = ctx.emit('build.waiting', {
        causes: [stuck['line'] as number],
        data: {
          part:
            furnitureKind(ctx.content, stuck).id === HEARTH
              ? `hearth ${placeOf(ctx.world, ctx.content, stuck).where}`
              : furnitureKind(ctx.content, stuck).name,
          x: stuck['x'] as number,
          y: stuck['y'] as number,
          good: furnitureLacks(
            ctx.content,
            furnitureKind(ctx.content, stuck),
            stuck['have'] as number,
          ).material,
        },
      });
    return false;
  }
  const kind = furnitureKind(content, piece);
  const here = placeOf(world, content, piece);
  // A smithy's forge, anvil block or tub is made the same way, for the smithy.
  const station = content.buildings.smithy.pieces.includes(kind.id);
  const smithy = content.buildings.smithy.name.toLowerCase();
  const well = kind.id === WELL;
  p['took'] = ctx.emit('work.tookUpHearth', {
    causes: [piece['line'] as number, priorityLine(world, p.id, job)].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      kind: station || here.indoors || well ? kind.name : 'campfire',
      room: station ? smithy : well ? 'green' : here.room,
      why: station
        ? `the ${smithy} has none`
        : well
          ? 'the water is far'
          : here.indoors
            ? 'it has no hearth'
            : 'the band has no fire',
    },
  });
  p['job'] = 'hearth';
  p['plan'] = piece.id;
  p['target'] = -1;
  return furnishing(ctx, p);
}

/** Whether someone alive, awake or asleep, is in a fire's reach now (`reach` if already worked
 * out). */
export function occupied(
  world: WorldState,
  content: EngineContent,
  piece: EntityRow,
  reach: readonly number[] = reachOf(world, content, piece),
): boolean {
  const tiles = new Set(reach);
  return (world.entities['person'] ?? []).some(
    (p) =>
      p['status'] === 'alive' &&
      p['z'] === 0 &&
      tiles.has((p['y'] as number) * world.map.width + (p['x'] as number)),
  );
}

/** Each hour, every lit fire someone is in the reach of is marked used now: the tenders' idle
 * rule reads it (V-048), and the fire itself knows no people (V-042). */
export function markUsed(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (world.tick % 60 !== 0) return;
  for (const f of firesOf(world))
    if (f['lit'] && occupied(world, content, pieceOfFire(world, f))) f['used'] = world.tick;
}
