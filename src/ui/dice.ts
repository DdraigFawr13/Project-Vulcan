// The seed die (6W Slice 1, V-192): a pixel die on an iron plate that rolls a two-word seed
// (`ember-hollow`) from region.json's word lists. The roll is the page's own pick of a seed, not a
// game rule, so it may use Math.random (GAME-01 binds the engine); the world a seed makes is
// unchanged, and a typed seed still makes the same world.
import { content } from '../content/index.ts';
import { el } from './dom.ts';

const NS = 'http://www.w3.org/2000/svg';

/** The die face at 12 by 12 art pixels: outline, face, shaded lower edge and five pips. */
const FACE = [
  '.##########.',
  '#bbbbbbbbbb#',
  '#bppbbbbppb#',
  '#bppbbbbppb#',
  '#bbbbppbbbb#',
  '#bbbbppbbbb#',
  '#bppbbbbppb#',
  '#bppbbbbppb#',
  '#bbbbbbbbbb#',
  '#ssssssssss#',
  '#ssssssssss#',
  '.##########.',
];
/** Each art pixel's class; the colours are tokens in hearth-screens.css. */
const PART: Readonly<Record<string, string>> = { '#': 'o', b: 'f', s: 's', p: 'p' };

/** A two-word seed from the content lists; `random` is 0 to 1 (Math.random on the page). */
export function rollSeed(random: () => number = Math.random): string {
  const { first, second } = content.region.seedWords;
  const pick = (words: readonly string[]): string =>
    words[Math.min(words.length - 1, Math.floor(random() * words.length))]!;
  return `${pick(first)}-${pick(second)}`;
}

function face(): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  FACE.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const part = PART[c];
      if (!part) return;
      const px = document.createElementNS(NS, 'rect');
      for (const [k, v] of [
        ['x', x],
        ['y', y],
        ['width', 1],
        ['height', 1],
      ] as const)
        px.setAttribute(k, String(v));
      px.setAttribute('class', part);
      svg.append(px);
    }),
  );
  return svg;
}

/** The die button: one tap hands a fresh seed to `onRoll`. */
export function diceButton(onRoll: (seed: string) => void): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    class: 'dice',
    'aria-label': 'Roll a new seed',
    'data-testid': 'dice',
  });
  button.append(face());
  button.addEventListener('click', () => onRoll(rollSeed()));
  return button;
}
