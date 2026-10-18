// A person's sheet (P2.6) in tabs: Needs (mood and needs, live), Skills (each with its practice
// towards the next level), Work (their priorities, as on the Work sheet) and Ledger (the lines
// about them). It shows what the snapshot says; nothing here decides a rule (GAME-02).
import type { LedgerLine, PersonView, WalkerView } from '../worker/index.ts';
import { el } from './dom.ts';
import type { Panel } from './panel.ts';
import { fillNeed, needRow, skillRows, whoLine } from './person.ts';

export type PersonTab = 'needs' | 'skills' | 'work' | 'ledger';
const TABS: readonly [PersonTab, string][] = [
  ['needs', 'Needs'],
  ['skills', 'Skills'],
  ['work', 'Work'],
  ['ledger', 'Ledger'],
];

export interface PersonSources {
  /** The open person's Work tab rows, from the Work sheet. */
  work(p: PersonView, w: WalkerView | undefined): HTMLElement[];
  /** The ledger lines the page holds, oldest first. */
  lines(): readonly LedgerLine[];
}

export class PersonSheet {
  private p: PersonView | undefined;
  private tab: PersonTab = 'needs';
  private walkers: readonly WalkerView[] = [];
  /** What they are doing and why (P2.9), above the tabs; filled in place each snapshot. */
  private now = el('div', { class: 'doingnow', 'data-testid': 'doing-now' });
  private rows: HTMLElement[] = [];
  /** What the open tab last showed, so it is redrawn only when that changes. */
  private drawn = '';

  private readonly panel: Panel;
  private readonly sources: PersonSources;

  constructor(panel: Panel, sources: PersonSources) {
    this.panel = panel;
    this.sources = sources;
  }

  /** Whose sheet is open, if any. */
  get id(): number | undefined {
    return this.panel.kind === 'person' ? this.p?.id : undefined;
  }

  show(p: PersonView, tab: PersonTab = this.p?.id === p.id ? this.tab : 'needs'): void {
    this.p = p;
    this.tab = tab;
    this.drawn = '';
    this.draw();
  }

  /** Each snapshot: needs move in place; another tab is redrawn when what it shows has changed. */
  setWalkers(walkers: readonly WalkerView[]): void {
    this.walkers = walkers;
    if (this.id === undefined) return;
    this.fillNow();
    if (this.tab === 'needs') this.fillNeeds();
    else if (this.key() !== this.drawn) this.draw();
  }

  private fillNeeds(): void {
    const w = this.walker();
    if (!w) return;
    [w.mood, ...w.needs].forEach((n, k) => this.rows[k] && fillNeed(this.rows[k], n));
  }

  /** "Doing now" and its why?, rebuilt only when the sentence or its line changes, so a chain
   * opened under it stays open and a tap never slips. */
  private fillNow(): void {
    const now = this.walker()?.now;
    const shown = now ? `${now.text}|${now.why ?? ''}` : '';
    if (this.now.dataset['shown'] === shown) return;
    this.now.dataset['shown'] = shown;
    this.now.replaceChildren();
    if (!now) return;
    if (now.why !== undefined) this.now.dataset['line'] = String(now.why);
    else delete this.now.dataset['line'];
    const text = el('p', {}, `${now.text} `);
    if (now.why !== undefined)
      text.append(
        el('button', { type: 'button', class: 'why', 'data-why': String(now.why) }, 'why?'),
      );
    this.now.append(el('small', {}, 'Doing now'), text);
  }

  /** New ledger lines: an open Ledger tab shows them. */
  lines(): void {
    if (this.id !== undefined && this.tab === 'ledger' && this.key() !== this.drawn) this.draw();
  }

  private walker = () => this.walkers.find((w) => w.id === this.p?.id);

  private mine = () => this.sources.lines().filter((l) => l.actors?.includes(this.p!.id));

  private key(): string {
    const w = this.walker();
    // Levels only: practice moves every few minutes of work, and each redraw replaces the tabs.
    if (this.tab === 'skills') return JSON.stringify(w?.skills.map((s) => s.level));
    if (this.tab === 'work')
      return JSON.stringify(this.sources.work(this.p!, w).map((r) => r.outerHTML));
    if (this.tab === 'ledger') return String(this.mine().at(-1)?.id);
    return '';
  }

  private draw(): void {
    const p = this.p!;
    const w = this.walker();
    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    for (const [tab, label] of TABS) {
      const b = el(
        'button',
        { type: 'button', 'aria-pressed': String(tab === this.tab), 'data-tab': tab },
        label,
      );
      b.addEventListener('click', () => this.show(p, tab));
      tabs.append(b);
    }
    this.drawn = this.key();
    this.now.dataset['shown'] = '-';
    this.panel.showView('person', p.home ? `${p.name} of ${p.home}` : p.name, [
      this.now,
      tabs,
      ...this.body(p, w),
    ]);
    this.fillNow();
    if (this.tab === 'needs') this.fillNeeds();
  }

  private body(p: PersonView, w: WalkerView | undefined): HTMLElement[] {
    if (this.tab === 'skills') {
      const skills = w?.skills ?? p.skills.map((s) => ({ ...s, practice: 0 }));
      const practice = el('div', { class: 'practice' });
      for (const s of skills)
        if (s.practice > 0 && s.level < s.potential)
          practice.append(
            el(
              'p',
              { class: 'aside' },
              `${s.name}: ${s.practice}% of the way to ${s.level + 1}, from practice.`,
            ),
          );
      return [
        el('p', {}, `Trade: ${p.trade}`),
        skillRows(skills, true),
        practice,
        el('p', { class: 'aside' }, 'Skills rise with use, up to the mark each person can reach.'),
        ...p.traits.map((t) => {
          const row = el('div', { class: 'prow' });
          row.append(el('b', {}, t.name), el('span', {}, t.description));
          return row;
        }),
      ];
    }
    if (this.tab === 'work') return this.sources.work(p, w);
    if (this.tab === 'ledger') {
      const lines = this.mine().slice(-50).reverse();
      const arrived = el('div', { class: 'line prow', 'data-line': String(p.arrived) });
      const text = el('span', {}, 'Came with the band ');
      // Archived lines are not held here; their "why?" ends at "older record", so it stays.
      const line = this.sources.lines().find((l) => l.id === p.arrived);
      if (line?.why !== false)
        text.append(
          el('button', { type: 'button', class: 'why', 'data-why': String(p.arrived) }, 'why?'),
        );
      arrived.append(text);
      return [...lines.map((l) => this.panel.lineRow(l)), arrived];
    }
    this.rows = [needRow(), ...(w?.needs ?? []).map(() => needRow())];
    return [el('p', { class: 'pwho' }, whoLine(p, true)), ...this.rows];
  }
}
