// The arrival screen (P2.1): before play, the five who came, where from, and who can build and
// cook, and where the band stopped the cart (the green) and why. Arrive closes it on the paused
// valley; Look elsewhere, offered once, has the band take the cart to its second choice (V-083).
// Shows the worker's views; decides nothing.
import type { PersonView } from '../worker/index.ts';
import { el } from './dom.ts';
import { ableWord, personCard } from './person.ts';
import { portrait } from './portrait.ts';

const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

export interface ArrivalView {
  place: string;
  date: string;
  people: readonly PersonView[];
  /** The line saying where the cart stopped and why, and whether it may still be sent back. */
  green: { text: string; again: boolean } | undefined;
}

export function showArrival(
  parent: HTMLElement,
  { place, date, people, green }: ArrivalView,
  arrive: () => void,
  lookAgain: () => void,
): void {
  const root = el('div', { class: 'arrival', 'data-testid': 'arrival' });
  const homes = new Map<string, PersonView>();
  for (const p of people) if (p.home && !homes.has(p.home)) homes.set(p.home, p);
  const from = [...homes.values()].map((p) => `${p.home}, ${p.homeDays} days ${p.homeDir}`);
  const head = el('div', { class: 'ahead' });
  head.append(
    el('div', { class: 'k' }, `${place} · ${date}`),
    el('h2', {}, `${people.length === 5 ? 'Five' : people.length} come to the valley`),
    el('p', {}, from.length ? `From ${list(from)}.` : 'From far off.'),
  );
  const cards = el('div', { class: 'cards' });
  for (const p of people) cards.append(personCard(p, portrait(p)));
  const more = el('div', { class: 'more', 'aria-hidden': 'true' });
  more.append(el('span', {}, `Scroll for all ${people.length} ▾`));
  // The hint goes once the last card is in view.
  cards.addEventListener('scroll', () => {
    more.hidden = cards.scrollTop + cards.clientHeight >= cards.scrollHeight - 8;
  });
  const foot = el('div', { class: 'afoot' });
  const able = new Map<string, string[]>();
  for (const p of people)
    for (const id of p.able) {
      const word = ableWord(id, p.skills.find((s) => s.id === id)?.name ?? id);
      able.set(word, [...(able.get(word) ?? []), p.name]);
    }
  // A fixed order ("can build" before "can cook"), whoever is listed first.
  const said = [...able]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([w, names]) => `${w[0]!.toUpperCase()}${w.slice(1)}: ${list(names)}.`);
  const go = el(
    'button',
    { type: 'button', class: 'big primary', 'data-testid': 'arrive' },
    'Arrive',
  );
  go.addEventListener('click', () => {
    root.remove();
    arrive();
  });
  foot.append(el('div', { class: 'ok' }, said.join(' ')));
  if (green) foot.append(el('p', { class: 'where', 'data-testid': 'green-line' }, green.text));
  const buttons = el('div', { class: 'ago' });
  if (green?.again) {
    const look = el('button', { type: 'button', class: 'big', 'data-testid': 'look-again' });
    look.append('Look elsewhere', el('small', {}, 'the band picks its next spot, once'));
    look.addEventListener('click', () => {
      root.remove();
      lookAgain();
    });
    buttons.append(look);
  }
  buttons.append(go);
  foot.append(buttons);
  root.append(head, cards, more, foot);
  parent.append(root);
  requestAnimationFrame(() => {
    more.hidden = cards.scrollHeight <= cards.clientHeight;
  });
}
