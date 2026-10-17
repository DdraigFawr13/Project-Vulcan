// The aura spots' glow (P1.4): a wash of the school's colour over each tile a spot reaches, fading
// ring by ring, and a bright core on the spot itself (frames `aura.<school>.1` and `.core`, drawn
// by tools/draw-ice.mjs). Picture only: the strength a tile has comes from the worker's inspector.
import { content } from '../content/index.ts';
import type { AuraView } from '../worker/index.ts';

/** The same rounded ring distance the engine uses (src/engine/map/aura.ts), no roots. */
const ringOf = (dx: number, dy: number): number => {
  const a = Math.abs(dx);
  const b = Math.abs(dy);
  return a > b ? a + (b >> 1) : b + (a >> 1);
};

/** Each tile a spot on level `z` reaches: its frame name and opacity, strongest spot first. */
export function glowTiles(
  spots: readonly AuraView[],
  z: number,
): { x: number; y: number; frame: string; alpha: number }[] {
  const { radius } = content.terrain.generator.aura;
  const out = new Map<string, { x: number; y: number; frame: string; alpha: number }>();
  for (const s of [...spots].filter((s) => s.z === z).sort((a, b) => b.strength - a.strength))
    for (let dy = -radius; dy <= radius; dy += 1)
      for (let dx = -radius; dx <= radius; dx += 1) {
        const ring = ringOf(dx, dy);
        const key = `${s.x + dx},${s.y + dy}`;
        if (ring > radius || out.has(key)) continue;
        out.set(key, {
          x: s.x + dx,
          y: s.y + dy,
          frame: `aura.${s.school}.${ring === 0 ? 'core' : '1'}`,
          // Fades faster toward the rim, so the wash does not muddy the ground around it.
          alpha: (1 - ring / (radius + 1)) ** 2,
        });
      }
  return [...out.values()];
}
