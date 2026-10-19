// Furniture as the page shows it (P3.4, P3.5): the pieces for the map, and a piece's tile rows,
// the bench's what-it-makes-and-next, and a carpenter's "doing now". Every value is the engine's
// answer put into words; nothing here decides a rule. Pure reads of the world, like build.ts.
import { content } from '../content/index.ts';
import {
  benchOf,
  furnitureKind,
  furnitureOf,
  houseAt,
  itemsOf,
  levelOf,
  nextWant,
  pieceAt,
  qualityOf,
  recordOf,
  roomAt,
  roomLacks,
  roomName,
  roomsOf,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { GoodsView, LedgerLine } from './protocol.ts';
import type { PieceView } from './protocol-build.ts';

const def = content.buildings.furniture;
const wood = content.items.find((i) => i.id === def.material)?.name ?? def.material;
const aOrAn = (word: string): string => `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;

const personName = (world: WorldState, id: unknown): string =>
  (world.entities['person'] ?? []).find((p) => p.id === id)?.['name'] as string;

/** The person on a planned piece, if any. */
const makerOf = (world: WorldState, piece: EntityRow): EntityRow | undefined =>
  (world.entities['person'] ?? []).find(
    (p) => p['status'] === 'alive' && p['job'] === 'carpentry' && p['plan'] === piece.id,
  );

/** The "Making" rows of a piece that is not built: the maker and what they are doing. */
function makingOf(world: WorldState, piece: EntityRow): string {
  const who = makerOf(world, piece);
  if (!who) return 'nobody yet';
  const load = itemsOf(world).find((i) => i['holder'] === who.id);
  const short = (piece['have'] as number) < furnitureKind(content, piece).cost;
  const doing = load
    ? `bringing ${load['count'] as number} ${wood}`
    : short
      ? `fetching ${wood}`
      : 'at work';
  return `${who['name'] as string}, ${doing}`;
}

/** The pieces the map draws: art and facing, planned ones faint (the page picks the frame). */
export const furnitureGoods = (world: WorldState): GoodsView['furniture'] =>
  furnitureOf(world).map((f) => ({
    x: f['x'] as number,
    y: f['y'] as number,
    z: f['z'] as number,
    art: furnitureKind(content, f).art,
    facing: f['facing'] as string,
    plan: f['state'] !== 'built',
  }));

/** What the colony makes next, and why, in the engine's own order (`nextWant`). */
function nextOf(world: WorldState): string {
  const last = content.work.priority.words.length;
  const anyone = (world.entities['person'] ?? []).some(
    (p) => p['status'] === 'alive' && levelOf(world, content, p.id, def.job) < last,
  );
  if (!anyone) return 'nobody makes furniture now';
  const want = nextWant(world, content);
  if (!want) return 'nothing; every room has its furniture';
  const kind = def.kinds.find((k) => k.id === want.kind)!;
  const n = want.need - want.have;
  const room = `the ${roomName(world, content, want.rr.h)}`;
  const what = n === 1 ? aOrAn(kind.name) : `${n} ${kind.name}s`;
  const why =
    kind.beds > 0
      ? `${room} sleeps ${want.have} of its ${want.need}`
      : kind.seats > 0
        ? `${room} seats ${want.have} of its ${want.need}`
        : `${room} has none`;
  return `${what}: ${why}`;
}

/** The bench's rows: the piece being made (or left half made), its maker, and next. */
function benchOfView(world: WorldState): NonNullable<PieceView['bench']> {
  const open = furnitureOf(world).filter((f) => f['state'] === 'plan' && f['kind'] !== 'bench');
  const piece = open.find((f) => makerOf(world, f)) ?? open[0];
  const next = nextOf(world);
  if (!piece) return { making: 'nothing now', maker: 'nobody at it now', next };
  const kind = furnitureKind(content, piece);
  const h = houseAt(world, piece['x'] as number, piece['y'] as number);
  const room = h ? ` for the ${roomName(world, content, h)}` : '';
  return {
    making: `${aOrAn(kind.name)}${room}, ${piece['have'] as number} of ${kind.cost} ${wood} here`,
    maker: makingOf(world, piece),
    next,
  };
}

/** A bed's privacy in words: the engine's own counts of who sleeps in its room. */
function privacyOf(world: WorldState, bed: EntityRow, sleepers: number): string {
  const owner = bed['owner'] ? personName(world, bed['owner']) : '';
  if (!owner) return sleepers ? `${sleepers} sleep here` : 'nobody sleeps here yet';
  return sleepers > 1 ? `${sleepers} sleep here` : `${owner} sleeps alone here`;
}

/** The claiming line of a bed, found among the recent lines (an older one is gone with its day). */
const claimOf = (world: WorldState, bed: EntityRow): SimEvent | undefined =>
  bed['owner']
    ? world.log.find(
        (e) =>
          e.type === 'people.claimedBed' &&
          e.causes.includes(bed['made'] as number) &&
          e.actors.includes(bed['owner'] as number),
      )
    : undefined;

/** The piece on surface tile (x, y), for the tile page. */
export function tilePiece(
  world: WorldState,
  x: number,
  y: number,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): { piece: PieceView } | undefined {
  const f = pieceAt(world, x, y);
  if (!f) return undefined;
  const kind = furnitureKind(content, f);
  const built = f['state'] === 'built';
  const line = (id: unknown) => {
    const e = recordOf(world, id as number);
    return e && lineOf(e);
  };
  const [placed, made] = [line(f['line']), built ? line(f['made']) : undefined];
  const room = built && kind.beds > 0 ? roomAt(world, content, x, y) : undefined;
  const claim = claimOf(world, f);
  const claimed = claim && lineOf(claim);
  const quality = qualityOf(content, f['quality'] as number);
  const maker = f['maker'] ? `, made by ${personName(world, f['maker'])}` : '';
  const sign = quality.beauty > 0 ? '+' : '';
  const owner = f['owner'] ? `${personName(world, f['owner'])}'s ${kind.name}` : 'nobody yet';
  return {
    piece: {
      kind: kind.id,
      name: kind.name,
      state: f['state'] as string,
      ...(built && {
        quality: `${quality.word}${maker}`,
        beauty: `${sign}${quality.beauty} to the room`,
      }),
      ...(kind.beds > 0 && { owner }),
      ...(room && {
        rest:
          content.life.sleep.bed > content.life.sleep.bedroll
            ? 'sleeping here restores rest faster than a bedroll'
            : 'sleeping here restores rest no faster than a bedroll',
        privacy: privacyOf(world, f, room.sleepers),
      }),
      ...(!built && {
        wood: `${f['have'] as number} of ${kind.cost} ${wood} here`,
        maker: makingOf(world, f),
      }),
      ...(f === benchOf(world) && { bench: benchOfView(world) }),
      ...(placed && { placed }),
      ...(made && { made }),
      ...(claimed && { claimed }),
    },
  };
}

/** A carpenter's "doing now" key and the words to fill it (content `work.doing`): the bench, a
 * bed (its room's sleepers and beds) or another piece (what the room has of it). */
export function carpentryDoing(
  world: WorldState,
  p: EntityRow,
): { key: string; vars: Record<string, string> } {
  const f = furnitureOf(world).find((r) => r.id === p['plan']);
  if (!f) return { key: 'carpentry', vars: {} };
  const kind = furnitureKind(content, f);
  const h = houseAt(world, f['x'] as number, f['y'] as number);
  const room = h ? roomName(world, content, h) : '';
  const vars = { kind: kind.name, room };
  if (kind.id === 'bench') return { key: 'carpentryBench', vars };
  const rr = h && roomsOf(world, content).find((r) => r.h.id === h.id);
  if (!rr) return { key: 'carpentryNeeds', vars };
  if (kind.beds > 0)
    return {
      key: 'carpentry',
      vars: { ...vars, sleepers: String(rr.room.sleepers), beds: String(rr.room.bedPieces) },
    };
  const lack = roomLacks(world, content, rr).find((l) => l.kind === kind.id);
  // The piece itself is counted once planned: what the room had when it was taken up is one less.
  const have = lack ? lack.have - (f['state'] === 'plan' ? 1 : 0) : 0;
  return !lack || lack.need === 1
    ? { key: 'carpentryNeeds', vars }
    : { key: 'carpentryMore', vars: { ...vars, have: String(have), need: String(lack.need) } };
}
