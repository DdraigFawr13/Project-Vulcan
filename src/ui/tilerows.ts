// What a tile page shows for what stands on it, one kind at a time: a piece, a field, a shaft
// plan or a plan or built part, after a metal works' own rows. Words from the worker (GAME-02).
import type { LedgerLine, TileView } from '../worker/index.ts';
import { fieldFacts, fieldLines } from './fieldrows.ts';
import { pieceFacts, pieceLines } from './piecerows.ts';
import { placeFacts, placeLines } from './placerows.ts';
import { planFacts, planLines } from './planrows.ts';
import { shaftFacts, shaftLines } from './shaftrows.ts';
import { worksFacts, worksLines } from './worksrows.ts';

/** The rows, key and value, of what stands on the tile. */
export const standingFacts = (tile: TileView): string[][] => [
  ...worksFacts(tile),
  ...(tile.place
    ? placeFacts(tile)
    : tile.piece
      ? pieceFacts(tile)
      : tile.field
        ? fieldFacts(tile)
        : tile.shaft
          ? shaftFacts(tile)
          : planFacts(tile)),
];

/** The lines behind what stands on the tile, with their labels. */
export const standingLines = (tile: TileView): [LedgerLine, string][] => [
  ...worksLines(tile),
  ...(tile.place
    ? placeLines(tile)
    : tile.piece
      ? pieceLines(tile)
      : tile.field
        ? fieldLines(tile)
        : tile.shaft
          ? shaftLines(tile)
          : planLines(tile)),
];
