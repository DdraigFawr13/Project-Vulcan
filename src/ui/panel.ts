// The side panel (a bottom sheet on narrow screens): the tile inspector, the ledger, the save
// list, and the sheets drawn elsewhere (person, Work, Alerts). Shows what the worker and the save store hand
// it; it computes no game rule (GAME-02).
import type { SaveMeta } from '../persist/index.ts';
import type { ClockView, LedgerLine, RegionView, StockView, TileView } from '../worker/index.ts';
import { el } from './dom.ts';
import { raceLegend, regionMap, siteWords } from './regionmap.ts';
import { stockRows } from './stock.ts';
import { testTools, type TestOrder } from './testtools.ts';

export type PanelKind =
  'tile' | 'person' | 'ledger' | 'saves' | 'region' | 'stock' | 'work' | 'alerts';

/** The ledger panel keeps this many newest lines; the full ledger is in saves and the export. */
export const LEDGER_LINES = 200;

export interface PanelActions {
  why(id: number): void;
  save(): void;
  exportLedger(): void;
  load(meta: SaveMeta): void;
  remove(meta: SaveMeta): void;
  newGame(seed: string): void;
  /** A test tool (`?debug`) on the tile shown: dig, mark a tree, add a store tile. */
  test(tile: TileView, kind: TestOrder, to?: number): void;
  /** The Stock lever: how much of `good` the colony keeps. */
  setStock(good: string, level: string): void;
  /** Follows the tile's stairs or shaft to level `z` and inspects the same spot there. */
  go(tile: TileView, z: number): void;
  close(): void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const when = (c: ClockView) => `${pad(c.hour)}:${pad(c.minute)}, Day ${c.day} of ${c.monthName}`;

export class Panel {
  private shown: PanelKind | undefined;
  private readonly root = el('aside', { class: 'panel', 'data-testid': 'panel', hidden: '' });
  private readonly title = el('h2');
  private readonly body = el('div', { class: 'panel-body' });
  private readonly actions: PanelActions;
  /** Shows developer rows (the tile's chunk and version); `?debug` in the URL. */
  private readonly debug: boolean;
  /** The Stock sheet's last view, so it is redrawn only when it changes. */
  private stock = '';

  constructor(parent: HTMLElement, actions: PanelActions, debug = false) {
    this.actions = actions;
    this.debug = debug;
    const close = el('button', { type: 'button', 'aria-label': 'Close panel' }, '✕');
    close.addEventListener('click', () => actions.close());
    const head = el('div', { class: 'panel-head' });
    head.append(this.title, close);
    this.root.append(head, this.body);
    this.root.addEventListener('click', (e) => this.onClick(e));
    parent.append(this.root);
  }

  /** Which view is open, if any. */
  get kind(): PanelKind | undefined {
    return this.shown;
  }

  hide(): void {
    this.shown = undefined;
    this.root.hidden = true;
  }

  /** The tile inspector; `depth` levels lie below the surface. */
  /** The tile's record, its ways up and down, and the test levers. `notice` is what became of the
   * last dig order here: a line saying it waits for time to run, or the ledger line refusing it. */
  showTile(tile: TileView, depth: number, notice?: string | LedgerLine): void {
    const where = tile.z === 0 ? '' : ` · ${tile.z} level${tile.z > 1 ? 's' : ''} down`;
    this.open('tile', `Tile ${tile.x}, ${tile.y}${where}`);
    const facts = el('dl', { class: 'kv' });
    for (const [key, value] of [
      ['ground', tile.ground],
      ...(tile.biome ? [['biome', tile.biome]] : []),
      ...(tile.elevation !== undefined ? [['height', `${tile.elevation} m`]] : []),
      ...(tile.fertility !== undefined ? [['fertility', `${tile.fertility} of 100`]] : []),
      ...(tile.temperature !== undefined ? [['temperature', `${tile.temperature} °C`]] : []),
      ...(tile.ice ? [['ice', tile.ice]] : []),
      ...(tile.aura ? [['aura', tile.aura]] : []),
      ...(tile.water ? [['water', tile.water]] : []),
      ...(tile.drinkable !== undefined ? [['drinkable', tile.drinkable ? 'yes' : 'no']] : []),
      ...(tile.crossing ? [['crossing', tile.crossing]] : []),
      ...(tile.feature ? [[tile.z ? 'vein' : 'on it', tile.feature]] : []),
      ...(tile.store ? [['store', 'part of the colony store']] : []),
      ...(tile.goods ?? []).map((g) => ['lying here', g.text]),
      ...(tile.below ? [['below', tile.below]] : []),
      ...(this.debug
        ? [['chunk', `${tile.chunkX}, ${tile.chunkY} · version ${tile.version}`]]
        : []),
    ])
      facts.append(el('dt', {}, key), el('dd', {}, value));
    this.body.replaceChildren(facts);
    if (tile.ways) {
      const go = el('div', { class: 'row' });
      if (tile.ways.down) {
        const down = el('button', { type: 'button', class: 'solid' }, `Go down to −${tile.z + 1}`);
        down.addEventListener('click', () => this.actions.go(tile, tile.z + 1));
        go.append(down);
      }
      if (tile.ways.up) {
        const label = tile.z === 1 ? 'Go up to the surface' : `Go up to −${tile.z - 1}`;
        const up = el('button', { type: 'button', class: 'solid' }, label);
        up.addEventListener('click', () => this.actions.go(tile, tile.z - 1));
        go.append(up);
      }
      this.body.append(go);
    }
    if (this.debug)
      this.body.append(...testTools(tile, depth, (kind, to) => this.actions.test(tile, kind, to)));
    if (typeof notice === 'string') this.body.append(el('p', { class: 'note' }, notice));
    else if (notice) this.body.append(this.lineRow(notice, 'Not dug · '));
    for (const g of tile.goods ?? [])
      if (g.made) this.body.append(this.lineRow(g.made, 'Made by · '));
    if (tile.store?.made && !tile.goods)
      this.body.append(this.lineRow(tile.store.made, 'Store · '));
    if (tile.changedBy) this.body.append(this.lineRow(tile.changedBy, 'Last changed · '));
    else this.body.append(el('p', { class: 'muted' }, 'The line that last changed it is gone.'));
  }

  /** The region map, read-only, with the settled valley marked; a tapped site shows who lives there. */
  showRegion(region: RegionView, site: number): void {
    const valley = region.valleys[site - 1];
    this.open('region', 'Region');
    const note = el('p', { class: 'note' }, 'Tap a settlement to see who lives there.');
    const map = regionMap(region, {
      selected: site,
      onlySelected: true,
      onSite: (s) => (note.textContent = siteWords(s)),
    });
    const near = el('ul');
    for (const n of valley?.near ?? [])
      near.append(el('li', {}, `${n.name}, ${n.culture} ${n.kind}, ${n.days} days ${n.dir}`));
    this.body.replaceChildren(
      el(
        'p',
        {},
        valley
          ? `Your valley: ${valley.name}${valley.range ? `, under ${valley.range}` : ''}.`
          : '',
      ),
      map,
      raceLegend(region),
      note,
      near,
      el(
        'p',
        { class: 'muted' },
        'No dealings with the neighbours yet: raids come in Phase 8, trade and travel in Phase 9.',
      ),
    );
  }

  /** The Stock sheet (P2.4): how much of each good the colony keeps, a level button for each. */
  showStock(stock: readonly StockView[]): void {
    this.open('stock', 'Stock');
    this.stock = '';
    this.setStock(stock);
  }

  /** Each snapshot's stock; an open Stock sheet is redrawn only when it has changed. */
  setStock(stock: readonly StockView[]): void {
    const key = JSON.stringify(stock);
    if (this.shown !== 'stock' || key === this.stock) return;
    this.stock = key;
    this.body.replaceChildren(
      ...stockRows(stock, (good, level) => this.actions.setStock(good, level)),
    );
  }

  /** A sheet drawn elsewhere (the person, Work and Alerts sheets): its title and its rows. */
  showView(kind: PanelKind, title: string, rows: readonly HTMLElement[]): void {
    this.open(kind, title);
    this.body.replaceChildren(...rows);
  }

  /** A panel with a title and one line of text. */
  showNote(title: string, text: string): void {
    this.open('region', title);
    this.body.replaceChildren(el('p', {}, text));
  }

  showLedger(lines: readonly LedgerLine[]): void {
    this.open('ledger', 'Ledger');
    this.body.replaceChildren();
    this.addLines(lines);
  }

  /** New lines at the top of an open ledger, keeping the newest `LEDGER_LINES`. */
  addLines(lines: readonly LedgerLine[]): void {
    if (this.shown !== 'ledger') return;
    for (const line of lines) this.body.prepend(this.lineRow(line));
    while (this.body.childElementCount > LEDGER_LINES) this.body.lastElementChild!.remove();
  }

  /** Opens the causes of line `id` under each place it is shown. */
  showCauses(id: number, lines: readonly (LedgerLine & { depth: number })[]): void {
    // Only the panel's own rows, not rows inside another line's open chain.
    for (const host of this.body.querySelectorAll<HTMLElement>(`:scope > [data-line="${id}"]`)) {
      host.querySelector(':scope > .chain')?.remove();
      const chain = el('div', { class: 'chain', 'data-testid': 'chain' });
      for (const line of lines) {
        const row = this.lineRow(line, '', false);
        row.style.setProperty('--depth', String(line.depth));
        if (!line.causes.length) row.querySelector('.when')!.append(' · the root');
        chain.append(row);
      }
      host.append(chain);
    }
  }

  showSaves(seed: string, saves: readonly SaveMeta[], problem = ''): void {
    this.open('saves', 'Saves');
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
      if (input.value.trim()) this.actions.newGame(input.value.trim());
    });
    this.body.replaceChildren(now, form);
    if (problem) this.body.append(el('p', { class: 'problem', role: 'alert' }, problem));
    if (!saves.length) this.body.append(el('p', { class: 'muted' }, 'No saves yet.'));
    for (const meta of saves) {
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
      load.addEventListener('click', () => this.actions.load(meta));
      acts.append(load);
      if (!meta.auto) {
        const remove = el('button', { type: 'button', class: 'dim' }, 'Delete');
        remove.addEventListener('click', () => this.actions.remove(meta));
        acts.append(remove);
      }
      text.append(acts);
      row.append(picture, text);
      this.body.append(row);
    }
  }

  private open(kind: PanelKind, title: string): void {
    this.shown = kind;
    this.title.textContent = title;
    this.root.hidden = false;
  }

  /** A ledger line: its number, when, its text and "why?" when it has causes. */
  lineRow(line: LedgerLine, prefix = '', why = true): HTMLElement {
    const row = el('div', { class: 'line', 'data-line': String(line.id) });
    row.append(
      el('b', { class: 'no' }, `#${line.id}`),
      el('span', { class: 'when' }, `${prefix}${when(line.clock)}`),
    );
    const text = el('span', {}, line.text);
    if (why && line.why) {
      text.append(' ');
      text.append(
        el('button', { type: 'button', class: 'why', 'data-why': String(line.id) }, 'why?'),
      );
    }
    row.append(text);
    return row;
  }

  private onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const why = target.dataset['why'];
    if (why) {
      const host = target.closest('[data-line]');
      const open = host?.querySelector(':scope > .chain');
      if (open) open.remove();
      else this.actions.why(Number(why));
    } else if (target.dataset['act'] === 'save') this.actions.save();
    else if (target.dataset['act'] === 'export') this.actions.exportLedger();
  }
}
