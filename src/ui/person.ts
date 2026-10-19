// A person in words (P2.1): the arrival screen's cards and the person panel share these pieces.
// Everything shown comes from the worker's `PersonView`; nothing here decides a rule.
import type { NeedView, PersonView } from '../worker/index.ts';
import { el } from './dom.ts';

/** What being able in a must-have skill is called on a card; other skills say "good at". */
const ABLE: Readonly<Record<string, string>> = { building: 'can build', cooking: 'can cook' };
export const ableWord = (id: string, name: string): string =>
  ABLE[id] ?? `good at ${name.toLowerCase()}`;

/** "Elf · Gwyllion · 36 · from Hyddog", with the distance when `far`. */
export function whoLine(p: PersonView, far = false): string {
  const from = p.home ? ` · from ${p.home}${far ? `, ${p.homeDays} days ${p.homeDir}` : ''}` : '';
  return `${p.raceName} · ${p.cultureName} · ${p.age}${from}`;
}

/** Skill rows: the name, a bar filled to the level with a tick at the potential, and the level. */
export function skillRows(skills: PersonView['skills'], numbers = false): HTMLElement {
  const grid = el('div', { class: numbers ? 'skills numbers' : 'skills' });
  for (const s of skills) {
    const bar = el('span', {
      class: 'sbar',
      role: 'img',
      'aria-label': `${s.name} ${s.level} of 20, can reach ${s.potential}`,
    });
    bar.append(
      el('i', { style: `width:${s.level * 5}%` }),
      el('b', { style: `left:${s.potential * 5}%` }),
    );
    grid.append(el('span', {}, s.name), bar);
    if (numbers) grid.append(el('span', { class: 'n' }, String(s.level)));
  }
  return grid;
}

/** The arrival screen's card for one person. */
export function personCard(p: PersonView, sprite: HTMLCanvasElement): HTMLElement {
  const card = el('div', { class: 'pcard', 'data-person': String(p.id) });
  const name = el('div', { class: 'pname' }, p.name);
  for (const id of p.able) {
    const skill = p.skills.find((s) => s.id === id);
    name.append(el('span', { class: 'badge' }, ableWord(id, skill?.name ?? id)));
  }
  const text = el('div');
  text.append(
    name,
    el('div', { class: 'pwho' }, whoLine(p)),
    skillRows(p.best),
    el('div', { class: 'ptraits' }, p.traits.map((t) => t.name).join(', ')),
  );
  card.append(sprite, text);
  return card;
}

/** A need or the mood as a bar row (P2.2): the name, the bar with its warning line, the word,
 * and "why?" while it is under the line. Built once, then filled in place by `fillNeed`, so a
 * chain of causes opened under it stays open as the numbers move. */
export function needRow(): HTMLElement {
  const row = el('div', { class: 'skills numbers need', 'data-line': '0' });
  const bar = el('span', { class: 'sbar', role: 'img' });
  bar.append(el('i'), el('b'));
  const word = el('span', { class: 'n' });
  row.append(el('span'), bar, word, el('span', { class: 'feeds' }));
  return row;
}

export function fillNeed(row: HTMLElement, n: NeedView): void {
  const [name, bar, word, feeds] = [...row.children] as HTMLElement[];
  row.dataset['line'] = String(n.why);
  row.classList.toggle('low', n.low);
  name!.textContent = n.name;
  bar!.setAttribute('aria-label', `${n.name} ${n.share} of 100, warning under ${n.line}`);
  (bar!.children[0] as HTMLElement).style.width = `${n.share}%`;
  (bar!.children[1] as HTMLElement).style.left = `${n.line}%`;
  // What feeds it (beauty, privacy), in words from the worker.
  if (feeds!.textContent !== (n.feeds ?? '')) feeds!.textContent = n.feeds ?? '';
  // Snapshots keep coming while paused, so the word and its "why?" are rebuilt only when they
  // change: a button replaced each snapshot slips out from under a finger mid-tap.
  const shown = n.low ? `${n.word}|${n.why}` : n.word;
  if (word!.dataset['shown'] === shown) return;
  word!.dataset['shown'] = shown;
  word!.textContent = `${n.word} `;
  if (n.low)
    word!.append(el('button', { type: 'button', class: 'why', 'data-why': String(n.why) }, 'why?'));
}
