// The dawn page (P2.9): each morning, yesterday in numbers, from the worker's tally, and who
// declined what, from the ledger. It opens by itself only at 1×, with no other sheet up, so a
// fast run is never interrupted; ⋯ → Yesterday opens it at any time. Shows; decides nothing.
import type { LedgerLine, YesterdayView } from '../worker/index.ts';
import { el } from './dom.ts';
import type { Panel } from './panel.ts';

const KEY = 'vulcan.dawnPage';

const shownAtDawn = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true; // storage blocked: the page still shows
  }
};

export class Dawn {
  private yesterday: YesterdayView | undefined;
  private food: number | undefined;
  /** The day last seen; undefined until the first snapshot of a world, which is not news. */
  private seen: string | undefined;
  private readonly panel: Panel;
  private readonly lines: () => readonly LedgerLine[];

  constructor(panel: Panel, lines: () => readonly LedgerLine[]) {
    this.panel = panel;
    this.lines = lines;
  }

  /** A world began or loaded: its first morning is not shown. */
  reset(): void {
    this.seen = undefined;
  }

  /** Each snapshot; a new yesterday at 1× with nothing open shows the page. */
  snapshot(yesterday: YesterdayView | undefined, food: number | undefined, slow: boolean): void {
    this.yesterday = yesterday;
    this.food = food;
    const key = yesterday ? `${yesterday.month} ${yesterday.day}` : '';
    if (this.seen === undefined) {
      this.seen = key;
      return;
    }
    if (key === this.seen) return;
    this.seen = key;
    if (key && slow && this.panel.kind === undefined && shownAtDawn()) this.show();
  }

  show(): void {
    const y = this.yesterday;
    if (!y) {
      this.panel.showView('dawn', 'Yesterday', [
        el('p', { class: 'empty' }, 'Your first night in the valley. Nothing done yet.'),
        this.foot(),
      ]);
      return;
    }
    const figures = el('dl', { class: 'tally', 'data-testid': 'dawn-tally' });
    for (const [label, n] of [
      ['Logs felled', y.felled],
      ['Items carried to the store', y.hauled],
      ['Berries picked', y.picked],
      ['Food eaten', y.eaten],
      ...(this.food !== undefined ? ([['Food in store now', this.food]] as const) : []),
    ] as const) {
      const row = el('div');
      row.append(el('dt', {}, label), el('dd', {}, String(n)));
      figures.append(row);
    }
    const declined = this.lines().filter(
      (l) => l.type === 'work.declined' && l.clock.day === y.day && l.clock.monthName === y.month,
    );
    const rows: HTMLElement[] = [figures];
    if (declined.length) {
      rows.push(el('h3', {}, 'Who declined what'));
      for (const l of declined) rows.push(this.panel.lineRow(l));
    }
    this.panel.showView('dawn', `Yesterday · Day ${y.day} of ${y.month}`, [...rows, this.foot()]);
  }

  private foot(): HTMLElement {
    const foot = el('div', { class: 'row dawnfoot' });
    const carry = el('button', { type: 'button', class: 'solid' }, 'Carry on');
    carry.addEventListener('click', () => this.panel.close());
    const on = shownAtDawn();
    const toggle = el(
      'button',
      { type: 'button', class: 'link', 'data-testid': 'dawn-toggle' },
      on ? "Don't show at dawn" : 'Show at dawn',
    );
    toggle.addEventListener('click', () => {
      try {
        if (on) localStorage.setItem(KEY, 'off');
        else localStorage.removeItem(KEY);
      } catch {
        // storage blocked: nothing to remember
      }
      this.panel.close();
    });
    foot.append(carry, toggle);
    return foot;
  }
}
