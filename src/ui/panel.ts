// The side panel (a bottom sheet on narrow screens): the tile inspector, the ledger, the save
// list, and the sheets drawn elsewhere (person, Work, Alerts). Shows what the worker and the save store hand
// it; it computes no game rule (GAME-02).
import type { SaveMeta } from '../persist/index.ts';
import type {
  ClockView,
  LedgerLine,
  LeftoversView,
  RegionView,
  StockView,
  TileView,
} from '../worker/index.ts';
import { el } from './dom.ts';
import { regionRows } from './regionmap.ts';
import { drawStock } from './stock.ts';
import { testMode } from './testmode.ts';
import { animalRows } from './animalsheet.ts';
import { saveRows } from './savesheet.ts';
import { tileRows, tileTitle } from './tilepanel.ts';
import type { TestOrder } from './testtools.ts';

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
  /** Send the plan of house `id` (or a shaft's, or the mill's) back: the colony chooses again. */
  sendBack(tile: TileView, id: number, kind: 'sendBack' | 'sendBackShaft' | 'sendBackMill'): void;
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
  /** Screen px the sheet covers at the bottom of the view: a phone's sheet, else 0. */
  below(): number {
    const r = this.root.getBoundingClientRect();
    return !this.root.hidden && r.bottom >= innerHeight - 2 && r.width > innerWidth * 0.8
      ? innerHeight - r.top
      : 0;
  }

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

  /** The tile's record (tilepanel.ts); a pasture, fold, hay meadow or rick tile opens that page
   * (Bundle 3), read-only. */
  showTile(tile: TileView, depth: number, notice?: string | LedgerLine): void {
    if (tile.pasture)
      return this.showView(
        'tile',
        tile.pasture.title,
        animalRows(tile.pasture, (l) => this.lineRow(l)),
      );
    this.open('tile', tileTitle(tile));
    const deps = {
      actions: this.actions,
      debug: this.debug,
      lineRow: (l: LedgerLine, prefix?: string) => this.lineRow(l, prefix),
    };
    this.body.replaceChildren(...tileRows(tile, depth, notice, deps));
  }

  /** The region map, read-only, with the settled valley marked; a tapped site shows who lives there. */
  showRegion(region: RegionView, site: number): void {
    this.open('region', 'Region');
    this.body.replaceChildren(...regionRows(region, site));
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
    this.body.replaceChildren(...saveRows(seed, saves, problem, this.actions, this.debug));
  }

  private open(kind: PanelKind, title: string): void {
    // A new sheet starts at its top; one redrawn in place keeps its place. A hidden sheet cannot
    // scroll, so it is shown first.
    const top = this.root.hidden || this.shown !== kind || this.title.textContent !== title;
    this.shown = kind;
    this.title.textContent = title;
    this.root.hidden = false;
    if (top) this.root.scrollTop = 0;
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
