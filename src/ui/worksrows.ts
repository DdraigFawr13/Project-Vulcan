// The tile page of the smelter, the charcoal clamp and the smithy (Bundle 3): what it is, why it
// lies here, what it makes, who is at it, and the lines behind it. Every value is words from the
// worker; nothing here decides a rule (GAME-02) or orders a person or a tile (V-041).
import type { LedgerLine, TileView } from '../worker/index.ts';
import { el } from './dom.ts';

/** The page's rows, key and value. */
export const worksFacts = (tile: TileView): [string, string][] => tile.works?.rows ?? [];

/** The lines behind it with their labels. */
export const worksLines = (tile: TileView): [LedgerLine, string][] =>
  (tile.works?.lines ?? []).map((l) => [l.line, l.label]);

/** What follows the facts: "Brokin, doing now" with the sentence and the line they took the work
 * up at, then a button to the item page of each tool or ingot lying here (view only). */
export function worksDoing(tile: TileView, open: (item: number) => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const doing = tile.works?.doing;
  if (doing) {
    const box = el('div', { class: 'doingnow' });
    const text = el('p', {}, `${doing.text} `);
    if (doing.why !== undefined) {
      box.dataset['line'] = String(doing.why);
      text.append(
        el('button', { type: 'button', class: 'why', 'data-why': String(doing.why) }, 'why?'),
      );
    }
    box.append(el('small', {}, `${doing.who}, doing now`), text);
    out.push(box);
  }
  for (const g of tile.goods ?? []) {
    if (g.item === undefined) continue;
    const id = g.item;
    const label = `Where it came from: ${g.text}`;
    const link = el('button', { type: 'button', class: 'why', 'data-testid': 'item-link' }, label);
    link.addEventListener('click', () => open(id));
    out.push(link);
  }
  return out;
}
