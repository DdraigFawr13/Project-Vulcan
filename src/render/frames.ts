// Where a named frame sits in a packed sheet's grid, and which picture a position hash picks.
// Picture choice only: nothing here touches the game's dice or state.
import type Phaser from 'phaser';

export const TILE = 32;

/** The tile index of frame `name` in `sheet` as a tileset (tools/pack-sheet: margin 1, spacing 2). */
export function frameIndex(
  textures: Phaser.Textures.TextureManager,
  sheet: string,
  name: string,
): number {
  const texture = textures.get(sheet);
  if (!texture.has(name)) throw new Error(`The ${sheet} sheet has no frame "${name}".`);
  const columns = Math.floor((texture.source[0]!.width - 2 + 2) / (TILE + 2));
  const frame = texture.get(name);
  return ((frame.cutY - 1) / (TILE + 2)) * columns + (frame.cutX - 1) / (TILE + 2);
}

/** A ground frame's index across the ground tilesets (in order), from whichever sheet has it. */
export function groundFrame(
  textures: Phaser.Textures.TextureManager,
  sheets: readonly string[],
  name: string,
): number {
  let offset = 0;
  for (const sheet of sheets) {
    const texture = textures.get(sheet);
    if (texture.has(name)) return offset + frameIndex(textures, sheet, name);
    const columns = Math.floor(texture.source[0]!.width / (TILE + 2));
    const rows = Math.floor(texture.source[0]!.height / (TILE + 2));
    offset += columns * rows;
  }
  throw new Error(`No ground sheet has a frame "${name}".`);
}

/** A position hash: the same tile always gives the same 32-bit value. */
export function hashAt(x: number, y: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Which of a kind's `variants` pictures (1-based) the tile at (x, y) shows. */
export function variantOf(x: number, y: number, variants: number): number {
  return (hashAt(x, y) % variants) + 1;
}
