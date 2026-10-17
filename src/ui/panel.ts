// The side panel (a bottom sheet on narrow screens): the tile inspector, the ledger and the save
// list. Shows what the worker and the save store hand it; it computes no game rule (GAME-02).
import type { SaveMeta } from '../persist/index.ts';
import type { ClockView, LedgerLine, TileView } from '../worker/index.ts';
import { el } from './dom.ts';

export type PanelKind = 'tile' | 'ledger' | 'saves';

/** The ledger panel keeps this many newest lines; the full ledger is in saves and the export. */
export const LEDGER_LINES = 200;

export interface PanelActions {
  why(id: number): void;
  save(): void;
  exportLedger(): void;
  load(meta: SaveMeta): void;
  remove(meta: SaveMeta): void;
  newGame(seed: string): void;
  /** The test levers: stairs down, or a shaft down to level `to`, from the tile shown. */
  dig(tile: TileView, kind: 'cutStairs' | 'sinkShaft', to?: number): void;
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

  constructor(parent: HTMLElement, actions: PanelActions) {
    this.actions = actions;
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
  showTile(tile: TileView, depth: number): void {
    const where = tile.z === 0 ? '' : ` · ${tile.z} level${tile.z > 1 ? 's' : ''} down`;
    this.open('tile', `Tile ${tile.x}, ${tile.y}${where}`);
    const facts = el('dl', { class: 'kv' });
    for (const [key, value] of [
      ['ground', tile.ground],
      ...(tile.biome ? [['biome', tile.biome]] : []),
      ...(tile.elevation !== undefined ? [['height', `${tile.elevation} m`]] : []),
      ...(tile.fertility !== undefined ? [['fertility', `${tile.fertility} of 100`]] : []),
      ...(tile.water ? [['water', tile.water]] : []),
      ...(tile.drinkable !== undefined ? [['drinkable', tile.drinkable ? 'yes' : 'no']] : []),
      ...(tile.crossing ? [['crossing', tile.crossing]] : []),
      ...(tile.feature ? [[tile.z ? 'vein' : 'on it', tile.feature]] : []),
      ...(tile.below ? [['below', tile.below]] : []),
      ['chunk', `${tile.chunkX}, ${tile.chunkY} · version ${tile.version}`],
    ])
      facts.append(el('dt', {}, key), el('dd', {}, value));
    this.body.replaceChildren(facts);
    if (tile.z < depth) {
      const acts = el('div', { class: 'row' });
      const stairs = el('button', { type: 'button' }, 'Cut stairs down');
      stairs.addEventListener('click', () => this.actions.dig(tile, 'cutStairs'));
      const shaft = el('button', { type: 'button' }, `Sink a shaft to −${depth}`);
      shaft.addEventListener('click', () => this.actions.dig(tile, 'sinkShaft', depth));
      acts.append(stairs, shaft);
      this.body.append(
        acts,
        el(
          'p',
          { class: 'muted' },
          'Test tools until colonists can dig (stairs in Phase 3, mining in Phase 4). They finish on the next game minute.',
        ),
      );
    }
    if (tile.changedBy) this.body.append(this.line(tile.changedBy, 'Last changed · '));
    else this.body.append(el('p', { class: 'muted' }, 'The line that last changed it is gone.'));
  }

  showLedger(lines: readonly LedgerLine[]): void {
    this.open('ledger', 'Ledger');
    this.body.replaceChildren();
    this.addLines(lines);
  }

  /** New lines at the top of an open ledger, keeping the newest `LEDGER_LINES`. */
  addLines(lines: readonly LedgerLine[]): void {
    if (this.shown !== 'ledger') return;
    for (const line of lines) this.body.prepend(this.line(line));
    while (this.body.childElementCount > LEDGER_LINES) this.body.lastElementChild!.remove();
  }

  /** Opens the causes of line `id` under each place it is shown. */
  showCauses(id: number, lines: readonly (LedgerLine & { depth: number })[]): void {
    // Only the panel's own rows, not rows inside another line's open chain.
    for (const host of this.body.querySelectorAll<HTMLElement>(`:scope > [data-line="${id}"]`)) {
      host.querySelector(':scope > .chain')?.remove();
      const chain = el('div', { class: 'chain', 'data-testid': 'chain' });
      for (const line of lines) {
        const row = this.line(line, line.depth > 1 ? `${'· '.repeat(line.depth - 1)}` : '', false);
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

  private line(line: LedgerLine, prefix = '', why = true): HTMLElement {
    const row = el('div', { class: 'line', 'data-line': String(line.id) });
    row.append(el('span', { class: 'when' }, `${prefix}${when(line.clock)} · #${line.id}`));
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
