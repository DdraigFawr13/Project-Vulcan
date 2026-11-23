// The tile page's words for the ground and for unknown ground and veins below (Bundle 2, V-215):
// nothing on the surface marks ore, and a vein below stays dark until it is known (V-030).
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, step, submitCommand } from '../engine/index.ts';
import { tileView } from './views.ts';

const sim = createSim(content);
const nobody = () => ({}) as never;

describe('tile page', () => {
  const w = createWorld(sim, 'ledger');
  const { map } = w;
  // Pages of seen ground: unseen surface says only "not yet seen" (trips.test.ts).
  map.known.fill(1);
  const at = (i: number) => [i % map.width, Math.floor(i / map.width)] as const;

  it('says nothing of ore on a rock face with a seam in it', () => {
    const i = map.faces.findIndex((v) => v > 1);
    expect(i).toBeGreaterThanOrEqual(0);
    const tile = tileView(w, ...at(i), 0, nobody)!;
    expect(JSON.stringify(tile)).not.toMatch(/stain|seam| ore\b|lies below/);
  });

  it('says unknown ground below is unknown, its vein unnamed, until it is known', () => {
    const { startX: x, startY: y } = map;
    submitCommand(w, { tick: w.tick + 1, kind: 'sinkShaft', data: { x, y, z: 0, to: 3 } });
    step(w, sim, 1);
    const layer = map.levels[2]!;
    const vein = layer.features.findIndex((f, i) => f > 0 && !layer.known[i]);
    expect(vein).toBeGreaterThanOrEqual(0);
    const [vx, vy] = at(vein);
    const dark = tileView(w, vx, vy, 3, nobody)!;
    expect(dark.ground).toBe('unknown: nobody has dug next to it');
    expect(dark.feature).toBeUndefined();
    expect(dark.below).toBeUndefined();
    const metal = content.features[layer.features[vein]! - 1]!;
    // Once known, the page says what the tile holds.
    layer.known[vein] = 1;
    const seen = tileView(w, vx, vy, 3, nobody)!;
    expect(seen.ground).not.toMatch(/unknown/);
    expect(seen.feature).toMatch(new RegExp(`, ${metal.amount} (ore|\\w+) in this tile$`));
  });
});
