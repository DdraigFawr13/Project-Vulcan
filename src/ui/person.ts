// A person in words (P2.1): the arrival screen's cards and the person panel share these pieces.
// Everything shown comes from the worker's `PersonView`; nothing here decides a rule.
import type { PersonView } from '../worker/index.ts';
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
