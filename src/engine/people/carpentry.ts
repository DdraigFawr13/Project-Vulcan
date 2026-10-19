// Carpentry (P3.4, V-041): nobody is told to make furniture. A free person able for the carpentry
// job (the Work sheet's Carpentry row, after Building) takes up the bench the colony planned,
// else a piece already started, else the next thing a room lacks (build/wants.ts). They fetch the
// wood, bring it to the bench (the bench's own plan, for the bench), work there for the piece's
// minutes (shorter with crafting skill, which they practise), and the piece is set at the spot
// chosen when it was taken up. Its quality is their crafting level plus a seeded roll.
import { streamFor, type EntityRow, type FurnitureKind } from '../core/index.ts';
import {
  anyBench,
  benchOf,
  furnitureKind,
  furnitureOf,
  houseAt,
  nextWant,
  qualityOf,
  roomName,
  wantSignature,
  type Want,
} from '../build/index.ts';
import { addEntity } from '../entity/index.ts';
import { layHearth } from '../fire/index.ts';
import { itemsOf, layItem, loadOf, raiseStock, takeFrom } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { stackOf } from './build.ts';
import { practise } from './learn.ts';
import { able, declineIfUnable, outranked, priorityLine } from './priority.ts';
import { goBeside, people, same, skillOf, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

/** The skill a kind is made with: carpentry's, or its own job's (a hearth, by builders). */
const trade = (ctx: SystemContext, kind: FurnitureKind): string =>
  ctx.content.jobs.find((j) => j.id === (kind.job ?? ctx.content.buildings.furniture.job))?.skill ??
  '';

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Stops: the piece is done, gone or out of reach (anything carried goes to the store). */
function stop(p: EntityRow): false {
  p['job'] = '';
  p['plan'] = 0;
  p['target'] = -1;
  return false;
}

/** The pieces started that nobody is on, the bench first (it is the only one before a bench
 * stands). */
function openPieces(ctx: SystemContext, p: EntityRow): EntityRow[] {
  const { world } = ctx;
  const on = new Set(
    people(world)
      .filter((q) => q.id !== p.id && q['job'] === 'carpentry')
      .map((q) => q['plan']),
  );
  const built = !!benchOf(world);
  // A hearth is the builders' (hearth.ts).
  return furnitureOf(world).filter(
    (f) =>
      f['state'] === 'plan' &&
      !on.has(f.id) &&
      !furnitureKind(ctx.content, f).job &&
      (f['kind'] === 'bench' || built),
  );
}

/** What `p` would make now: a piece started, else (once a bench stands) the next thing a room
 * lacks. Wood they can reach is needed for a new piece. */
function choose(ctx: SystemContext, p: EntityRow): { piece?: EntityRow; want?: Want } | undefined {
  const { world, content } = ctx;
  if (!anyBench(world)) return undefined;
  const material = content.buildings.furniture.material;
  const open = openPieces(ctx, p)[0];
  if (open) return { piece: open };
  if (!benchOf(world)) return undefined;
  // A search that found nothing is not repeated until what rooms lack could have changed.
  const sig = wantSignature(world, content);
  if (ctx.state['idle'] === sig) return undefined;
  const want = nextWant(world, content);
  ctx.state['idle'] = want ? 0 : sig;
  return want && stackOf(ctx, p, material) ? { want } : undefined;
}

/** Why a want is made, in the words of its taking-up line. */
function whyOf(w: Want, name: string): string {
  const { room } = w.rr;
  if (w.kind === 'bed')
    return `it has ${plural(room.sleepers, 'sleeper')} and ${plural(room.bedPieces, 'bed')}`;
  return w.need > 1
    ? `it has ${plural(w.have, name)} for ${plural(w.need, 'sleeper')}`
    : `it has no ${name}`;
}

/** Takes up carpentry if there is something to make and nobody free who puts it higher could. */
export function takeUpCarpentry(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.buildings.furniture;
  if (!anyBench(world)) return false;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  if (outranked(ctx, p, def.job, (q) => choose(ctx, q) !== undefined)) return false;
  const pick = choose(ctx, p);
  if (!pick) return false;
  const bench = anyBench(world)!;
  const benchLine = (bench['made'] as number) || (bench['line'] as number);
  let piece = pick.piece;
  const kindId = piece ? (piece['kind'] as string) : pick.want!.kind;
  const kind = content.buildings.furniture.kinds.find((k) => k.id === kindId)!;
  const h = piece ? houseAt(world, piece['x'] as number, piece['y'] as number) : pick.want!.rr.h;
  if (piece && (piece['have'] as number) < kind.cost && !stackOf(ctx, p, def.material)) {
    // The wood cannot be reached: said once, until some is brought.
    piece['waited'] ||= ctx.emit('build.waiting', {
      causes: [piece['line'] as number],
      data: { part: kind.name, x: piece['x'] as number, y: piece['y'] as number, good: 'logs' },
    });
    return false;
  }
  const why = pick.want
    ? whyOf(pick.want, kind.name)
    : kindId === 'bench'
      ? 'nobody can make furniture without one'
      : 'it was started and left';
  p['took'] = ctx.emit('work.tookUpCarpentry', {
    causes: [
      ...[
        kindId === 'bench' ? (bench['line'] as number) : benchLine,
        h?.['built'] as number,
        priorityLine(world, p.id, def.job),
      ].filter((l): l is number => !!l),
    ],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      kind: kind.name,
      room: h ? roomName(world, content, h) : '',
      why,
    },
  });
  if (!piece) {
    const at = pick.want!.at;
    const id = addEntity(world, 'furniture', {
      ...{ kind: kindId, x: at.x, y: at.y, z: 0, facing: at.facing, quality: 0, maker: 0 },
      ...{
        owner: 0,
        made: 0,
        line: p['took'] as number,
        state: 'plan',
        have: 0,
        work: -1,
        waited: 0,
      },
    });
    piece = furnitureOf(world).find((f) => f.id === id)!;
    raiseStock(ctx, def.material, kind.name, p['took'] as number);
  }
  p['job'] = 'carpentry';
  p['plan'] = piece.id;
  p['target'] = -1;
  return furnishing(ctx, p);
}

/** Goes for the wood (or the hearth's stone), or picks it up when standing on it. */
function fetchWood(ctx: SystemContext, p: EntityRow, need: number, material: string): boolean {
  const { world, content } = ctx;
  let item = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (!item) {
    item = stackOf(ctx, p, material);
    if (!item) return stop(p);
    p['target'] = item.id;
  }
  if (!same(spotOf(item), spotOf(p))) return walkTo(ctx, p, spotOf(item)) || stop(p);
  const count = Math.min(need, content.work.haul.load, item['count'] as number);
  if (count === (item['count'] as number)) item['holder'] = p.id;
  else {
    takeFrom(world, item, count);
    const kind = item['kind'] as string;
    const id = layItem(world, { kind, count, ...spotOf(p), made: item['made'] as number });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  }
  p['target'] = -1;
  return true;
}

/** One minute on the piece they took up; false when it is done, gone or out of reach (they look
 * for work again, and wood they carry goes to the store). */
export function furnishing(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.buildings.furniture;
  const piece = furnitureOf(world).find((f) => f.id === p['plan']);
  if (!piece || piece['state'] === 'built') return stop(p);
  const kind = furnitureKind(content, piece);
  const material = kind.material ?? def.material;
  // The bench and a hearth are made where they stand; everything else is made at the bench.
  const at = piece['kind'] === 'bench' || kind.job ? piece : benchOf(world);
  if (!at) return stop(p);
  const [x, y] = [at['x'] as number, at['y'] as number];
  const here = spotOf(p);
  const beside = here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1;
  const need = kind.cost - (piece['have'] as number);
  const load = loadOf(world, p.id);
  if (load && (need <= 0 || load['kind'] !== material)) return stop(p);
  if (load) {
    if (!beside) return goBeside(ctx, p, x, y) || stop(p);
    const used = Math.min(need, load['count'] as number);
    Object.assign(piece, { have: (piece['have'] as number) + used, waited: 0 });
    takeFrom(world, load, used);
    return true;
  }
  if (need > 0) return fetchWood(ctx, p, need, material);
  if (!beside) return goBeside(ctx, p, x, y) || stop(p);
  const level = skillOf(world, p, trade(ctx, kind));
  const skilled = kind.job ? content.buildings.skilled : def.skilled;
  if ((piece['work'] as number) < 0)
    piece['work'] = Math.max(1, Math.ceil((kind.minutes * skilled) / (skilled + level)));
  piece['work'] = (piece['work'] as number) - 1;
  practise(ctx, p, trade(ctx, kind), p['took'] as number);
  if ((piece['work'] as number) > 0) return true;
  if (kind.job) layHearth(ctx, p, piece);
  else finish(ctx, p, piece, level);
  stop(p);
  return true;
}

/** The piece is made: its quality is the maker's crafting level plus a roll of up to `roll` either
 * way. It stands at the spot chosen when it was taken up. */
function finish(ctx: SystemContext, p: EntityRow, piece: EntityRow, level: number): void {
  const { world, content } = ctx;
  const def = content.buildings.furniture;
  const score = level + streamFor(world, def.stream).between(-def.roll, def.roll);
  const word = qualityOf(content, score).word;
  const kind = furnitureKind(content, piece);
  const h = houseAt(world, piece['x'] as number, piece['y'] as number);
  const bench = benchOf(world);
  const made = ctx.emit('furniture.made', {
    causes: [
      p['took'] as number,
      ...(bench
        ? [(bench['made'] as number) || (bench['line'] as number)]
        : [piece['line'] as number]),
    ].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word} ${kind.name}`,
      room: h ? roomName(world, content, h) : '',
    },
  });
  Object.assign(piece, { state: 'built', quality: score, maker: p.id, made, work: 0, waited: 0 });
}
