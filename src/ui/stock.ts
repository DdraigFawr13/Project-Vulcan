// The Stock sheet (P2.4): the colony's standing order for how much of each good to keep. The
// player picks a level; who fells and hauls is the colonists' own choice (V-015). Shows what the
// worker hands it; it computes no game rule (GAME-02).
import { content } from '../content/index.ts';
import type { FlockPlate, LeftoversView, StockView } from '../worker/index.ts';
import { el } from './dom.ts';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** One block per good: what the colony has and wants, and a button per level. */
export function stockRows(
  stock: readonly StockView[],
  set: (good: string, level: string) => void,
  leftovers: LeftoversView,
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
    if (s.status) block.append(el('p', { class: 'aside', 'data-status': '' }, s.status));
    if (s.note) block.append(el('p', { class: 'aside', 'data-note': '' }, s.note));
    if (s.kept) block.append(el('p', { class: 'aside', 'data-kept': '' }, s.kept));
    // The food plate names the game and fish that count towards it (Bundle 2).
    if (s.good === 'food') {
      const aside = el('p', { class: 'aside', 'data-testid': 'food-mix' });
      block.append(aside);
      foodMix(aside, leftovers);
    }
    // Foraging's good says when the bushes bear (P2.9, V-040), from content.
    const { good, months } = content.work.forage;
    if (s.good === good && months.length)
      block.append(
        el(
          'p',
          { class: 'aside' },
          `Berries grow back from ${months[0]} to ${months.at(-1)}, and not in the cold months.`,
        ),
      );
    return block;
  });
  return [
    el('p', {}, 'How much the colony keeps in its stores. Whoever is free and able does the work.'),
    ...rows,
    ...(leftovers.flock ? [flockBlock(leftovers.flock)] : []),
    leftoverBlock(leftovers),
  ];
}

/** "Game 72 and fish 9 count as food...", hidden while the colony has neither. */
function foodMix(aside: HTMLElement, l: LeftoversView): void {
  const parts = [l.game ? `Game ${l.game}` : '', l.fish ? `fish ${l.fish}` : ''].filter(Boolean);
  aside.hidden = parts.length === 0;
  aside.textContent = `${parts.join(' and ')} count as food, beside the cart’s preserved food.`;
}

/** The flock plate (Bundle 3): head by kind word and the hay in the rick, read-only. The levers
 * are the Pasture and Herding rows, not this sheet. */
function flockBlock(plate: FlockPlate): HTMLElement {
  const block = el('div', { class: 'kept', 'data-testid': 'stock-flock' });
  block.append(el('h3', {}, 'The flock'), fillFlock(el('div', { 'data-flock': '' }), plate));
  block.append(
    el(
      'p',
      { class: 'aside' },
      'The herders keep only what the hay can feed. Nothing to set here: the Pasture row and the Herding row are the levers.',
    ),
  );
  return block;
}

/** "Sheep: 7 kept (1 ram, 6 ewes)" and "Hay: 830 in the rick...", one line each. */
function fillFlock(box: Element, plate: FlockPlate): Element {
  const lines = [...plate.head, ['Hay', plate.hay]];
  const key = JSON.stringify(lines);
  if (box.getAttribute('data-key') === key) return box;
  box.setAttribute('data-key', key);
  box.replaceChildren(
    ...lines.map(([name, text]) => {
      const p = el('p');
      p.append(el('b', {}, name!), `: ${text}`);
      return p;
    }),
  );
  return box;
}

/** What the kills leave: kept in the store until a trade uses them (Phase 5B). */
function leftoverBlock(l: LeftoversView): HTMLElement {
  const block = el('div', { class: 'kept', 'data-testid': 'stock-leftovers' });
  block.append(
    el('h3', {}, 'Leftovers'),
    fillLeftovers(el('p', { 'data-leftovers': '' }), l),
    el(
      'p',
      { class: 'aside' },
      `Kept in the store until a trade uses them: ${l.items.some((i) => i.item === 'fleece') ? 'fleece for the loom, ' : ''}hides for the tanner, fat for candles (Phase 5B). Guts and scraps go to the midden past the town ring.`,
    ),
  );
  return block;
}

/** "Hides: 3 · Bone: 6 · Fat: 3", each good's name in bold. */
function fillLeftovers(p: Element, l: LeftoversView): Element {
  const text = l.items.map((i) => `${cap(i.name)}: ${i.have}`).join(' · ');
  if (p.textContent === text) return p;
  p.replaceChildren(
    ...l.items.flatMap((i, n) => [n ? ' · ' : '', el('b', {}, cap(i.name)), `: ${i.have}`]),
  );
  return p;
}

/** Each snapshot: the counts change in place, so a level button never slips out from under a tap. */
export function fillStock(
  body: HTMLElement,
  stock: readonly StockView[],
  leftovers: LeftoversView,
): void {
  const flock = body.querySelector('[data-flock]');
  if (flock && leftovers.flock) fillFlock(flock, leftovers.flock);
  const kept = body.querySelector('[data-leftovers]');
  if (kept) fillLeftovers(kept, leftovers);
  const mix = body.querySelector<HTMLElement>('[data-testid="food-mix"]');
  if (mix) foodMix(mix, leftovers);
  for (const s of stock) {
    const head = body.querySelector(`[data-testid="stock-${s.good}"] > p`);
    if (head?.lastChild) head.lastChild.textContent = `: ${haveLine(s)}`;
    // The metal line moves as the work does.
    const status = body.querySelector(`[data-testid="stock-${s.good}"] > [data-status]`);
    if (status && s.status && status.textContent !== s.status) status.textContent = s.status;
    // An ore count in a plate's note moves as miners haul.
    const note = body.querySelector(`[data-testid="stock-${s.good}"] > [data-note]`);
    if (note && s.note && note.textContent !== s.note) note.textContent = s.note;
  }
}

const haveLine = (s: StockView): string =>
  s.want ? `${s.have} of ${s.want} wanted` : `${s.have} kept, none wanted`;

/** Draws the sheet anew when a level changed since `drawn` (its last key), else fills the counts
 * in place; returns the new key. */
export function drawStock(
  body: HTMLElement,
  drawn: string,
  stock: readonly StockView[],
  leftovers: LeftoversView,
  set: (good: string, level: string) => void,
): string {
  const key = JSON.stringify([
    stock.map((s) => [s.good, s.level, s.want, s.levels]),
    !!leftovers.flock,
  ]);
  if (key === drawn) fillStock(body, stock, leftovers);
  else body.replaceChildren(...stockRows(stock, set, leftovers));
  return key;
}
