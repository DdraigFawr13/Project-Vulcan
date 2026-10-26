// A piece of furniture on the tile page (P3.4, P3.5): what it is and how it was made, its owner
// and room for a bed, and for the bench what it makes and what comes next. Every value is words
// from the worker; nothing here decides a rule (GAME-02, V-041).
import type { LedgerLine, TileView } from '../worker/index.ts';

/** The tile page's rows for a piece, key and value. It blocks no one's way (engine), so the
 * paths row says so. A bed adds its room and role. */
export function pieceFacts(tile: TileView): [string, string][] {
  const { piece, room } = tile;
  if (!piece) return [];
  const built = piece.state === 'built';
  const rows: [string, string][] = [
    [built ? 'built' : 'plan', `${piece.name}, ${built ? 'built' : 'planned'}`],
  ];
  if (piece.fire) {
    // A hearth or campfire (P3.6): the fire's state, its fuel and what it warms replace the first row.
    rows[0] = [piece.name, `${piece.fire.state}, ${piece.fire.where}`];
    rows.push(['fuel', piece.fire.fuel], ['warms', piece.fire.reach]);
  }
  if (piece.bench) {
    rows.push(
      ['making', piece.bench.making],
      ['maker', piece.bench.maker],
      ['next', piece.bench.next],
    );
  }
  if (piece.wood) rows.push([piece.good ?? 'logs', piece.wood]);
  if (piece.maker) rows.push(['maker', piece.maker]);
  if (piece.quality) rows.push(['quality', piece.quality]);
  if (piece.owner) rows.push(['owner', piece.owner]);
  if (piece.beauty && !piece.bench && !piece.fire) rows.push(['beauty', piece.beauty]);
  if (piece.rest) rows.push(['rest', piece.rest]);
  if (room && built && piece.owner)
    rows.push(['room', `${room.name}, ${room.tiles} tiles inside`], ['role', room.role]);
  if (piece.privacy) rows.push(['privacy', piece.privacy]);
  if (room && built && piece.fire) rows.push(['room', `${room.name}, ${room.tiles} tiles inside`]);
  if (room && built && piece.fire) rows.push(['warmth', room.warmth], ['light', room.light]);
  rows.push(['paths', 'does not block the way']);
  // On the smithy's page the piece adds only what and who made it; the page says the rest.
  return tile.works
    ? rows.filter(([k]) => ['built', 'plan', 'quality', 'maker'].includes(k))
    : rows;
}

/** The lines behind a piece with their labels: claimed, made, and placed (the bench's, or while
 * it is still being made). */
export function pieceLines(tile: TileView): [LedgerLine, string][] {
  const { piece } = tile;
  if (!piece) return [];
  const lines: [LedgerLine | undefined, string][] = [
    [piece.fire?.last, `${piece.fire?.lastLabel ?? 'Last'} · `],
    [piece.claimed, 'Claimed · '],
    [piece.made, 'Made · '],
    [!piece.made || piece.bench ? piece.placed : undefined, 'Placed · '],
  ];
  // The fire's last line leads; the same line is not shown again as the hearth's making.
  const seen = new Set<number>();
  return lines.filter((l): l is [LedgerLine, string] => {
    if (!l[0] || seen.has(l[0].id)) return false;
    seen.add(l[0].id);
    return true;
  });
}
