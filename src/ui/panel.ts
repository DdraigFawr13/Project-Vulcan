// The side panel (a bottom sheet on narrow screens): the tile inspector, the ledger, the save
// list, and the sheets drawn elsewhere (person, Work, Alerts). Shows what the worker and the save store hand
// it; it computes no game rule (GAME-02).
import type { SaveMeta } from '../persist/index.ts';
import type { ClockView, LedgerLine, RegionView, StockView, TileView } from '../worker/index.ts';
import type { LeftoversView } from '../worker/index.ts';
import { el } from './dom.ts';
import { raceLegend, regionMap, siteWords } from './regionmap.ts';
import { drawStock } from './stock.ts';
import { testMode } from './testmode.ts';
import { landFacts } from './landrows.ts';
import { placeHead, placeTitle } from './placerows.ts';
import { shaftBack, shaftTitle } from './shaftrows.ts';
import { standingFacts, standingLines } from './tilerows.ts';
import { worksDoing } from './worksrows.ts';
import { versionLine } from './version.ts';
import { testTools, type TestOrder } from './testtools.ts';

export type PanelKind =
  | 'tile'
  | 'person'
  | 'ledger'
  | 'saves'
  | 'region'
  | 'stock'
  | 'work'
  | 'build'
  | 'laws'
  | 'item'
  | 'animal'
  | 'alerts'
  | 'dawn';

/** The ledger panel keeps this many newest lines; the full ledger is in saves and the export. */
export const LEDGER_LINES = 200;

export interface PanelActions {
  why(id: number): void;
  save(): void;
  exportLedger(): void;
  load(meta: SaveMeta): void;
  remove(meta: SaveMeta): void;
  newGame(seed: string): void;
  /** A test tool (test mode) on the tile shown: dig, mark a tree, add a store tile. */
  test(tile: TileView, kind: TestOrder, arg?: number | string): void;
  /** Send the plan of house `id` (or of a shaft, `sendBackShaft`) back: the colony chooses again. */
  sendBack(tile: TileView, id: number, kind: 'sendBack' | 'sendBackShaft'): void;
  /** Opens the item page of a tool or an ingot stack (view only). */
  item(id: number): void;
  /** The Stock lever: how much of `good` the colony keeps. */
  setStock(good: string, level: string): void;
  /** Test mode: skips a month or a season, tick by tick, then pauses. */
  jump(span: 'month' | 'season'): void;
  /** Follows the tile's stairs or shaft to level `z` and inspects the same spot there. */
  go(tile: TileView, z: number): void;
  close(): void;
}

/** What a stain on the ground means (taste board pick, V-087); the colours are content. */
const STAIN_NOTE =
  'Stains show where ore lies below: green for copper, grey for tin, rust for iron. Miners dig where a wanted metal’s stain is; you set what is wanted on the Stock sheet.';

const pad = (n: number) => String(n).padStart(2, '0');
const when = (c: ClockView) => `${pad(c.hour)}:${pad(c.minute)}, Day ${c.day} of ${c.monthName}`;

export class Panel {
  private shown: PanelKind | undefined;
  /** The "why?" just tapped and where its chain goes, until the worker answers. */
  private asked: { id: number; at: HTMLElement } | undefined;
  private readonly root = el('aside', { class: 'panel', 'data-testid': 'panel', hidden: '' });
  private readonly title = el('h2');
  private readonly body = el('div', { class: 'panel-body' });
  private readonly actions: PanelActions;
  /** Test mode: the test tools and developer rows (the tile's chunk and version). */
  private readonly debug: boolean;
  /** The Stock sheet's last view, so it is redrawn only when it changes. */
  private stock = '';
  private leftovers: LeftoversView = { items: [], game: 0, fish: 0 };
  private latest: readonly StockView[] = [];

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

  /** Closes the sheet as its ✕ does. */
  close(): void {
    this.actions.close();
  }

  hide(): void {
    this.shown = undefined;
    this.root.hidden = true;
  }

  /** The tile's record, its ways up and down, and the test levers. `notice` is what became of the
   * last dig order here: a line saying it waits for time to run, or the ledger line refusing it. */
  showTile(tile: TileView, depth: number, notice?: string | LedgerLine): void {
    const where = tile.z === 0 ? '' : ` · ${tile.z} level${tile.z > 1 ? 's' : ''} down`;
    this.open(
      'tile',
      tile.works?.name ??
        (placeTitle(tile) || undefined) ??
        tile.field?.name ??
        (shaftTitle(tile) || `Tile ${tile.x}, ${tile.y}${where}`),
    );
    const facts = el('dl', { class: 'kv' });
    // What lies here comes first: it is usually what a tap was after (Morgan, Phase 3 playtest).
    for (const [key, value] of [
      ...(tile.goods ?? []).map((g) => ['lying here', g.text]),
      ...(tile.piece || tile.field || tile.shaft || tile.works || tile.place
        ? []
        : landFacts(tile)),
      ...(tile.feature ? [[tile.z ? 'vein' : 'on it', tile.feature]] : []),
      ...(tile.store ? [['store', 'part of the colony store']] : []),
      ...standingFacts(tile),
      ...(tile.below && !tile.piece && !tile.works ? [['below', tile.below]] : []),
      ...(this.debug
        ? [['chunk', `${tile.chunkX}, ${tile.chunkY} · version ${tile.version}`]]
        : []),
    ])
      facts.append(el('dt', {}, key), el('dd', {}, value));
    this.body.replaceChildren(...placeHead(tile), facts);
    this.body.append(...worksDoing(tile, (id) => this.actions.item(id)));
    if (tile.stain && !tile.piece && !tile.field && !tile.shaft)
      this.body.append(el('p', { class: 'aside' }, STAIN_NOTE));
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
    if (tile.house?.back) {
      const back = el('button', { type: 'button', 'data-testid': 'send-back-tile' }, 'Send back');
      back.addEventListener('click', () => this.actions.sendBack(tile, tile.house!.id, 'sendBack'));
      const row = el('div', { class: 'row' });
      row.append(back);
      this.body.append(row);
    }
    this.body.append(
      ...shaftBack(tile, () => this.actions.sendBack(tile, tile.shaft!.id, 'sendBackShaft')),
    );
    if (this.debug)
      this.body.append(
        ...testTools(tile, depth, (kind, arg) => this.actions.test(tile, kind, arg)),
      );
    if (typeof notice === 'string') this.body.append(el('p', { class: 'note' }, notice));
    else if (notice) this.body.append(this.lineRow(notice, 'Not done · '));
    for (const [line, label] of standingLines(tile)) this.body.append(this.lineRow(line, label));
    for (const g of tile.goods ?? [])
      if (g.made) this.body.append(this.lineRow(g.made, 'Made by · '));
    if (tile.store?.made && !tile.goods)
      this.body.append(this.lineRow(tile.store.made, 'Store · '));
    if (tile.piece || tile.works || tile.place) return;
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
  showStock(): void {
    this.open('stock', 'Stock');
    this.stock = '';
    this.setStock(this.latest);
  }

  /** Each snapshot's stock; an open Stock sheet is redrawn only when a level has changed, and
   * the counts hauling moves are filled in place. */
  setStock(stock: readonly StockView[], leftovers = this.leftovers): void {
    [this.latest, this.leftovers] = [stock, leftovers];
    if (this.shown !== 'stock') return;
    const set = (good: string, level: string) => this.actions.setStock(good, level);
    this.stock = drawStock(this.body, this.stock, stock, leftovers, set);
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
    // The panel's own rows (not rows inside another line's open chain) and the place that was
    // tapped, wherever it sits (a memory, a lean link).
    const hosts = new Set(this.body.querySelectorAll<HTMLElement>(`:scope > [data-line="${id}"]`));
    if (this.asked?.id === id && this.body.contains(this.asked.at)) hosts.add(this.asked.at);
    this.asked = undefined;
    for (const host of hosts) {
      host.querySelector(`:scope > .chain[data-for="${id}"]`)?.remove();
      const chain = el('div', { class: 'chain', 'data-testid': 'chain', 'data-for': String(id) });
      for (const line of lines) {
        const row = this.lineRow(line, '', false);
        row.style.setProperty('--depth', String(line.depth));
        if (!line.causes.length && !line.older) row.querySelector('.when')!.append(' · the root');
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
    // Test mode is a switch you can find on a phone (Morgan's playtest), off by default.
    const test = el('div', { class: 'row' });
    test.append(
      el(
        'button',
        {
          type: 'button',
          'data-act': 'testmode',
          'data-testid': 'test-switch',
          'aria-pressed': String(this.debug),
        },
        this.debug ? 'Test mode: on' : 'Test mode: off',
      ),
    );
    const about = el(
      'p',
      { class: 'aside' },
      'Direct tools for trying things out: dig down, mark a tree, add a store tile, jump ahead in time. Your colonists choose their own work in the normal game.',
    );
    // Jumps run every tick on the way, as a skip does, so what follows is what play would give.
    if (this.debug)
      for (const span of ['month', 'season'] as const) {
        const go = el(
          'button',
          { type: 'button', 'data-testid': `jump-${span}` },
          `Jump a ${span}`,
        );
        go.addEventListener('click', () => {
          this.actions.jump(span);
          this.actions.close();
        });
        test.append(go);
      }
    this.body.replaceChildren(now, form, versionLine(), el('h3', {}, 'Test mode'), about, test);
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
    // A new sheet starts at its top; one redrawn in place keeps its place.
    if (this.root.hidden || this.shown !== kind || this.title.textContent !== title)
      this.root.scrollTop = 0;
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
      // The chain opens under its own line when it has one, else under the tapped button's parent.
      const at = target.closest<HTMLElement>(`[data-line="${why}"]`) ?? target.parentElement!;
      const open = at.querySelector(`:scope > .chain[data-for="${why}"]`);
      if (open) open.remove();
      else {
        this.asked = { id: Number(why), at };
        this.actions.why(Number(why));
      }
    } else if (target.dataset['act'] === 'save') this.actions.save();
    else if (target.dataset['act'] === 'export') this.actions.exportLedger();
    else if (target.dataset['act'] === 'testmode') testMode(!this.debug);
  }
}
