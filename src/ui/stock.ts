// The Stock sheet (P2.4): the colony's standing order for how much of each good to keep. The
// player picks a level; who fells and hauls is the colonists' own choice (V-015). Shows what the
// worker hands it; it computes no game rule (GAME-02).
import type { StockView } from '../worker/index.ts';
import { el } from './dom.ts';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** One block per good: what the colony has and wants, and a button per level. */
export function stockRows(
  stock: readonly StockView[],
  set: (good: string, level: string) => void,
): HTMLElement[] {
  const rows = stock.map((s) => {
    const block = el('div', { 'data-testid': `stock-${s.good}` });
    const levels = el('div', { class: 'row', role: 'group', 'aria-label': `${cap(s.name)} kept` });
    for (const l of s.levels) {
      const on = l.id === s.level;
      const button = el(
        'button',
        { type: 'button', 'aria-pressed': String(on), ...(on && { class: 'solid' }) },
        `${cap(l.id)}${l.count ? ` (${l.count})` : ''}`,
      );
      button.addEventListener('click', () => set(s.good, l.id));
      levels.append(button);
    }
    const head = el('p');
    head.append(el('b', {}, cap(s.name)), `: ${haveLine(s)}`);
    block.append(head, levels);
    return block;
  });
  return [
    el('p', {}, 'How much the colony keeps in its store. Whoever is free and able does the work.'),
    ...rows,
    el('p', { class: 'muted' }, 'Stone and ore join this sheet when quarrying and mining arrive.'),
  ];
}

/** Each snapshot: the counts change in place, so a level button never slips out from under a tap. */
export function fillStock(body: HTMLElement, stock: readonly StockView[]): void {
  for (const s of stock) {
    const head = body.querySelector(`[data-testid="stock-${s.good}"] > p`);
    if (head?.lastChild) head.lastChild.textContent = `: ${haveLine(s)}`;
  }
}

const haveLine = (s: StockView): string =>
  s.want ? `${s.have} of ${s.want} wanted` : `${s.have} kept, none wanted`;
