// Seen at work (V-194): the numbers of the drawn work motions, as approved on the mock-up
// (https://claude.ai/artifact/QD7htqM6kKxKHNiDKtukx1). Positions are in a person's own sprite
// pixels (the 32 px frame, before the person's scale), facing east; west is the mirror. A picture
// choice only: what the person does comes from the worker (`WalkerView.act`).

export type Motion = 'swing' | 'dig' | 'crouch' | 'stir' | 'bench';

/** One beat of a motion: seconds a stroke takes (real time, the same at every game speed,
 * Morgan's Q5 A), where in the stroke the bits fly, and for the tool motions its three angles in
 * degrees (0 points east, -90 up): at rest, at the top of the lift and at the strike. */
export interface Beat {
  period: number;
  strikes: readonly number[];
  angles?: { rest: number; top: number; hit: number };
}

export const BEATS: Readonly<Record<Motion, Beat>> = {
  swing: { period: 1.0, strikes: [0.66], angles: { rest: 20, top: -150, hit: 30 } },
  dig: { period: 1.2, strikes: [0.66], angles: { rest: 40, top: -110, hit: 70 } },
  crouch: { period: 1.6, strikes: [0.5] },
  stir: { period: 1.4, strikes: [0.05, 0.5] },
  bench: { period: 0.6, strikes: [0.5] },
};

/** The held tool's longest side: 18 px at 1x on the mock-up (Q3 C), in sprite pixels. */
export const TOOL_SIZE = 18 / 1.25;
/** Where the hand holds the tool at rest, facing east. */
export const HAND = { x: 20, y: 18.4 };
/** The angle a tool is carried at while walking to work. */
export const CARRY_ANGLE = -60;
/** Past this angle the lifted tool passes behind the head. */
export const BEHIND = -95;

const ease = (p: number): number => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** The tool's angle at phase `p` (0 to 1) of a stroke: a slow lift, a fast strike, a short rest
 * on the work, then back. */
export function swingAngle(p: number, a: { rest: number; top: number; hit: number }): number {
  if (p < 0.55) return a.rest + (a.top - a.rest) * ease(p / 0.55);
  if (p < 0.66) return a.top + (a.hit - a.top) * ((p - 0.55) / 0.11);
  if (p < 0.8) return a.hit;
  return a.hit + (a.rest - a.hit) * ease((p - 0.8) / 0.2);
}

/** How the body sits at phase `p`: shifted `dx`, `dy` (east-facing) and pressed down by
 * `squash` rows (a crouch); for tool motions the tool's angle and the hand's place. */
export interface Pose {
  dx: number;
  dy: number;
  squash: number;
  tool?: { angle: number; x: number; y: number };
}

export function poseAt(motion: Motion, p: number): Pose {
  const a = BEATS[motion].angles;
  if (a) {
    const angle = swingAngle(p, a);
    // The body leans back on the lift and forward on the strike, and dips a pixel as it lands.
    const lean = p < 0.55 ? -1 : p < 0.8 ? 1 : 0;
    const dy = p > 0.62 && p < 0.8 ? 1 : 0;
    // The hand rises about 5 px as the tool goes up (Q1 A).
    const up = Math.max(0, Math.min(1, (a.rest - angle) / (a.rest - a.top)));
    const x = HAND.x + (lean - Math.round(up * 2)) * 0.8;
    const y = HAND.y + (dy - Math.round(up * 5)) * 0.8;
    return { dx: lean, dy, squash: 0, tool: { angle, x, y } };
  }
  if (motion === 'crouch') return { dx: 0, dy: 0, squash: p < 0.5 ? 4 : 5 };
  if (motion === 'stir')
    return { dx: Math.round(Math.sin(p * 2 * Math.PI) * 1.4), dy: 0, squash: 0 };
  return { dx: 0, dy: p < 0.5 ? 0 : 1, squash: 0 };
}

/** Whether a stroke's phase passed `mark` going from `a` to `b` (wrapping at 1). */
export const crossed = (a: number, b: number, mark: number): boolean =>
  a <= b ? a < mark && b >= mark : b >= mark || a < mark;

/** Where bits leave the work, facing east: the struck spot for a tool, the ground before the
 * feet for a crouch, the bench or pot before the chest otherwise. */
export function strikeAt(motion: Motion): { x: number; y: number; up: number } {
  const a = BEATS[motion].angles;
  if (a) {
    const r = (a.hit * Math.PI) / 180;
    return { x: HAND.x + Math.cos(r) * TOOL_SIZE, y: HAND.y + Math.sin(r) * TOOL_SIZE, up: 40 };
  }
  if (motion === 'crouch') return { x: 26, y: 28, up: 15 };
  if (motion === 'stir') return { x: 26, y: 14, up: 10 };
  return { x: 27, y: 19, up: 20 };
}

/** A tool icon's grip and head (sprite pixels of its frame): the opaque box, the lowest point of
 * the handle, and the angle from it to the middle of the top third, where the head is. Worked out
 * from the icon's pixels, so a new tool's art needs no entry here. */
export interface Grip {
  box: { x: number; y: number; w: number; h: number };
  grip: { x: number; y: number };
  head: number;
}

export function gripOf(
  opaque: (x: number, y: number) => boolean,
  w: number,
  h: number,
): Grip | undefined {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (opaque(x, y)) {
        xs.push(x);
        ys.push(y);
      }
  if (!xs.length) return undefined;
  const [x0, x1] = [Math.min(...xs), Math.max(...xs) + 1];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys) + 1];
  const bottom = y1 - 1;
  const low = xs.filter((_, i) => ys[i] === bottom);
  // A handle straight down (a pick) is held at its middle; a slanted one at its lower end.
  const upright = low.length > 0 && Math.max(...low) - Math.min(...low) <= 3 && x1 - x0 > 20;
  const gx = upright ? (Math.min(...low) + Math.max(...low)) / 2 : Math.min(...low);
  const top = ys.map((y, i) => (y <= y0 + 0.3 * (y1 - y0) ? i : -1)).filter((i) => i >= 0);
  const hx = top.reduce((n, i) => n + xs[i]!, 0) / top.length;
  const hy = top.reduce((n, i) => n + ys[i]!, 0) / top.length;
  return {
    box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
    grip: { x: gx + 0.5, y: y1 },
    head: (Math.atan2(hy - bottom, hx - gx) * 180) / Math.PI,
  };
}
