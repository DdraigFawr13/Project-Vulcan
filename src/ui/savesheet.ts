// The Saves sheet (panel.ts `showSaves`): Save now and Export, a new game from a seed, the version,
// the test mode switch, and a row per save with Load and Delete. Shows the save store's
// list; decides nothing (GAME-02).
import type { SaveMeta } from '../persist/index.ts';
import { el } from './dom.ts';
import type { PanelActions } from './panel.ts';
import { versionLine } from './version.ts';

/** The sheet's rows; Save now, Export and the test switch are answered by the panel's clicks. */
export function saveRows(
  seed: string,
  saves: readonly SaveMeta[],
  problem: string,
  actions: PanelActions,
  debug: boolean,
): HTMLElement[] {
  const now = el('div', { class: 'row' });
  now.append(
    el('button', { type: 'button', class: 'solid', 'data-act': 'save' }, 'Save now'),
    el('button', { type: 'button', 'data-act': 'export' }, 'Export ledger'),
  );
  const form = el('form', { class: 'row', 'aria-label': 'New game' });
  const input = el('input', {
    name: 'seed',
    value: seed,
    'aria-label': 'Seed',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  form.append(input, el('button', { type: 'submit' }, 'New game'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim()) actions.newGame(input.value.trim());
  });
  // Test mode is a switch you can find on a phone (Morgan's playtest), off by default.
  const test = el('div', { class: 'row' });
  test.append(
    el(
      'button',
      {
        type: 'button',
        'data-act': 'testmode',
        'data-testid': 'test-switch',
        'aria-pressed': String(debug),
      },
      debug ? 'Test mode: on' : 'Test mode: off',
    ),
  );
  const about = el(
    'p',
    { class: 'aside' },
    'Direct tools for trying things out: dig down, mark a tree, add a store tile. Your colonists choose their own work in the normal game.',
  );
  const rows = [now, form, versionLine(), el('h3', {}, 'Test mode'), about, test];
  if (problem) rows.push(el('p', { class: 'problem', role: 'alert' }, problem));
  if (!saves.length) rows.push(el('p', { class: 'muted' }, 'No saves yet.'));
  rows.push(...saves.map((meta) => saveRow(meta, actions)));
  return rows;
}

/** One save: its picture, name and tags, when, Load, and Delete for any save but an autosave. */
function saveRow(meta: SaveMeta, actions: PanelActions): HTMLElement {
  const row = el('div', { class: 'save', 'data-testid': 'save' });
  const picture = el('img', { class: 'thumb', alt: '', src: meta.thumbnail || 'data:,' });
  const text = el('div', { class: 'meta' });
  const name = el('b', {}, meta.name);
  if (meta.auto) name.append(el('span', { class: 'tag' }, 'AUTO'));
  if (meta.rescue) name.append(el('span', { class: 'tag', title: meta.rescue }, 'RESCUE'));
  const saved = new Date(meta.savedAt).toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  text.append(name, el('span', {}, `${meta.auto ? 'Autosaved' : 'Saved'} ${saved}`));
  const acts = el('div', { class: 'row' });
  const load = el('button', { type: 'button' }, 'Load');
  load.addEventListener('click', () => actions.load(meta));
  acts.append(load);
  if (!meta.auto) {
    const remove = el('button', { type: 'button', class: 'dim' }, 'Delete');
    remove.addEventListener('click', () => actions.remove(meta));
    acts.append(remove);
  }
  text.append(acts);
  row.append(picture, text);
  return row;
}
