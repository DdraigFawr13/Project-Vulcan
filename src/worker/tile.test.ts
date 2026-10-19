// The tile page's words for ore stains on the surface and for unknown ground and veins below
// (Bundle 2): what the inspector may say about ground nobody has dug next to (V-030, V-087).
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, step, submitCommand } from '../engine/index.ts';
import { tileView } from './views.ts';

const sim = createSim(content);
const nobody = () => ({}) as never;

describe('tile page', () => {
  const w = createWorld(sim, 'ledger');
  const { map } = w;
  const at = (i: number) => [i % map.width, Math.floor(i / map.width)] as const;

  it('names the stain on a stained surface tile and where its ore lies', () => {
    const i = map.stains.findIndex((s) => s > 0);
    expect(i).toBeGreaterThanOrEqual(0);
    const vein = content.features[map.stains[i]! - 1]!;
    const [x, y] = at(i);
    const tile = tileView(w, x, y, 0, nobody)!;
    expect(tile.ground).toMatch(new RegExp(` with a ${vein.vein!.stainWord} stain$`));
    expect(tile.stain).toMatch(new RegExp(`lies below, on level ${vein.vein!.level}$`));
    const bare = map.stains.findIndex((s) => s === 0);
    expect(tileView(w, ...at(bare), 0, nobody)!.stain).toBeUndefined();
  });

  it('says unknown ground below is unknown, with its vein glinting, until it is known', () => {
    const { startX: x, startY: y } = map;
    submitCommand(w, { tick: w.tick + 1, kind: 'sinkShaft', data: { x, y, z: 0, to: 3 } });
    step(w, sim, 1);
    const layer = map.levels[2]!;
    const vein = layer.features.findIndex((f, i) => f > 0 && !layer.known[i]);
    expect(vein).toBeGreaterThanOrEqual(0);
    const [vx, vy] = at(vein);
    const dark = tileView(w, vx, vy, 3, nobody)!;
    expect(dark.ground).toBe('unknown: nobody has dug next to it');
    expect(dark.feature).toMatch(/ glints through the dark$/);
    expect(dark.below).toBeUndefined();
    const metal = content.features[layer.features[vein]! - 1]!;
    // Once known, the page says what the tile holds.
    layer.known[vein] = 1;
    const seen = tileView(w, vx, vy, 3, nobody)!;
    expect(seen.ground).not.toMatch(/unknown/);
    expect(seen.feature).toMatch(new RegExp(`, ${metal.amount} (ore|\\w+) in this tile$`));
  });
});
