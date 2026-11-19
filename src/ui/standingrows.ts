// The Laws sheet's head (P6.6, V-158, V-159): the colony's standing with its causes, the elder,
// and each faction's petition. A petition is answered only through the law: its first button sets
// the setting it asks for (`setLaw`), its second lets the law stand (`letStand`). Neither names a
// person; everything shown is the worker's `ColonyView` (GAME-02).
import type { ColonyView, FactionView } from '../worker/index.ts';
import { el } from './dom.ts';

export interface StandingActions {
  setLaw(law: string, setting: string): void;
  letStand(faction: number): void;
}

const why = (line: number): HTMLElement =>
  el('button', { type: 'button', class: 'why', 'data-why': String(line) }, 'why?');

const signed = (n: number): string => (n > 0 ? `+${n}` : `−${-n}`);

/** Standing as a number, a word and a bar, then its causes, biggest first. */
function standing(view: ColonyView): HTMLElement[] {
  const head = el('div', { class: 'standing', 'data-testid': 'standing' });
  head.append(
    el('h3', {}, 'Standing'),
    el('span', { class: 'sword' }, `${view.standing} · ${view.word}`),
  );
  const bar = el('div', {
    class: 'sbar',
    role: 'img',
    'aria-label': `Standing ${view.standing} of 100`,
  });
  bar.append(el('span', { style: `width:${view.standing}%` }));
  const rows: HTMLElement[] = [
    head,
    bar,
    el(
      'p',
      { class: 'aside' },
      `How far the colony trusts its laws. ${view.lean || 'It leans no answer either way.'}`,
    ),
  ];
  for (const c of view.causes.slice(0, 4)) {
    const row = el('p', { class: 'scause', 'data-line': String(c.why) });
    const times = c.times > 1 ? `, ${c.times} times` : '';
    row.append(el('b', {}, signed(c.by)), ` ${c.text}${times} `, why(c.why));
    rows.push(row);
  }
  if (!view.causes.length) rows.push(el('p', { class: 'muted' }, 'Nothing has moved it yet.'));
  return rows;
}

function elder(view: ColonyView): HTMLElement[] {
  if (!view.elder)
    return [
      el('p', { class: 'elder muted' }, 'No elder yet: nobody is trusted well above the rest.'),
    ];
  const p = el('p', { class: 'elder', 'data-line': String(view.elder.why) });
  p.append(`${view.elder.text} `, why(view.elder.why));
  return [p];
}

function petition(f: FactionView, actions: StandingActions): HTMLElement {
  const box = el('div', { class: 'petition', 'data-faction': String(f.id) });
  const said = el('p', {});
  said.append(el('b', {}, f.name), ` (${f.count}: ${f.members}). ${f.ask} `, why(f.why));
  box.append(said, el('p', { class: 'aside' }, f.note));
  if (f.state !== 'open') return box;
  const row = el('div', { class: 'row', role: 'group', 'aria-label': `Answer ${f.name}` });
  const give = el('button', { type: 'button', 'data-give': f.asks }, `Make it ${f.asksName}`);
  give.addEventListener('click', () => actions.setLaw(f.law, f.asks));
  const stand = el('button', { type: 'button', 'data-stand': String(f.id) }, 'Let it stand');
  stand.addEventListener('click', () => actions.letStand(f.id));
  row.append(give, stand);
  box.append(row);
  return box;
}

/** Standing, the elder, then the petitions, open ones first. */
export function colonyRows(view: ColonyView, actions: StandingActions): HTMLElement[] {
  const factions = [...view.factions].sort(
    (a, b) => Number(b.state === 'open') - Number(a.state === 'open'),
  );
  return [
    ...standing(view),
    ...elder(view),
    ...(factions.length
      ? [el('h4', {}, 'Petitions'), ...factions.map((f) => petition(f, actions))]
      : []),
  ];
}
