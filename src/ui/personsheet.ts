// A person's sheet (P2.6) in tabs: Needs (mood and needs, live), Health (P5.6, P5.8), Skills (each with its practice
// towards the next level), Work (their priorities, as on the Work sheet) and Ledger (the lines
// about them). It shows what the snapshot says; nothing here decides a rule (GAME-02).
import type { LedgerLine, PersonView, StrangerView, WalkerView } from '../worker/index.ts';
import { el } from './dom.ts';
import type { Panel } from './panel.ts';
import { fillBlood, healthBody, healthKey } from './healthtab.ts';
import { fillNeed, needRow, skillRows, whoLine } from './person.ts';

/** A stranger's page (P5.9): who, rows with "why?", and that nothing here takes them in. */
function strangerRows(s: StrangerView): HTMLElement[] {
  const rows = s.rows.map((r) => {
    const row = el('div', { class: 'prow' });
    const text = el('span', {}, r.text);
    if (r.why)
      text.append(
        ' ',
        el('button', { type: 'button', class: 'why', 'data-why': String(r.why) }, 'why?'),
      );
    row.append(el('b', {}, r.name), text);
    return row;
  });
  return [
    el('p', { class: 'pwho', 'data-testid': 'stranger' }, s.who),
    ...rows,
    el('p', { class: 'aside' }, s.foot),
  ];
}

export type PersonTab = 'needs' | 'health' | 'skills' | 'work' | 'ledger';
const TABS: readonly [PersonTab, string][] = [
  ['needs', 'Needs'],
  ['health', 'Health'],
  ['skills', 'Skills'],
  ['work', 'Work'],
  ['ledger', 'Ledger'],
];

export interface PersonSources {
  /** The open person's Work tab rows, from the Work sheet. */
  work(p: PersonView, w: WalkerView | undefined): HTMLElement[];
  /** The ledger lines the page holds, oldest first. */
  lines(): readonly LedgerLine[];
  /** Opens the item page of a tool they hold (view only). */
  item(id: number): void;
  /** Test mode only: gives them a wound by hand (the `hurt` command); none outside it. */
  hurt?(person: number, part: string, severity: string): void;
  /** Test mode only: makes them ill by hand (the `sicken` command). */
  sicken?(person: number, ill: string): void;
}

export class PersonSheet {
  private p: PersonView | undefined;
  private tab: PersonTab = 'needs';
  private walkers: readonly WalkerView[] = [];
  /** What they are doing and why (P2.9), above the tabs; filled in place each snapshot. */
  private now = el('div', { class: 'doingnow', 'data-testid': 'doing-now' });
  private rows: HTMLElement[] = [];
  /** The Health tab's Blood row, moved in place each snapshot. */
  private blood: HTMLElement | undefined;
  /** The Needs tab's Wearing and Memories sections, filled in place each snapshot. */
  private extra = el('div', { class: 'wearmem', 'data-testid': 'wear-memories' });
  /** A stranger's page is up (P5.9): it is redrawn as a whole, and as tabs once they stay. */
  private strangerShown = false;
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
    // A stranger's page (P5.9), redrawn when it changes, and the tabs once they stay.
    if (this.walker()?.stranger || this.strangerShown) {
      if (this.key() !== this.drawn) this.draw();
      return;
    }
    this.fillNow();
    if (this.tab === 'needs') this.fillNeeds();
    else if (this.key() !== this.drawn) this.draw();
    else if (this.tab === 'health') fillBlood(this.blood, this.walker()?.health);
  }

  private fillNeeds(): void {
    const w = this.walker();
    if (!w) return;
    [w.mood, ...w.needs].forEach((n, k) => {
      const row = this.rows[k];
      if (!row) return;
      // Warmth shows this person's own line, not the usual one (V-046).
      fillNeed(row, n.name === 'Warmth' ? { ...n, line: w.warmLine.line } : n);
    });
    this.fillExtra(w);
  }

  /** "Wearing" (a row per garment), "Memories" (each live one and the days left) and "Tools" (each
   * with its hours left, a button to its page; owned like a bed, so no lever); the text is the
   * worker's, redrawn only when it changes. */
  private fillExtra(w: WalkerView): void {
    const shown = JSON.stringify([w.wearing, w.memories, w.tools, w.law, w.warmLine, w.home]);
    if (this.extra.dataset['shown'] === shown) return;
    this.extra.dataset['shown'] = shown;
    const memories = w.memories.length
      ? w.memories.map((m) => {
          const row = el('div', { class: 'mem' });
          const left = m.days > 1 ? `${m.days} days left` : 'fades tomorrow';
          row.append(
            el('span', {}, m.text),
            el(
              'span',
              { class: 'pts' },
              `${m.mood > 0 ? '+' : '−'}${Math.abs(m.mood)} mood, ${left}${m.lean ? `, ${m.lean}` : ''}`,
            ),
            el('button', { type: 'button', class: 'why', 'data-why': String(m.why) }, 'why?'),
          );
          return row;
        })
      : [el('p', { class: 'muted' }, 'Nothing weighs on them now.')];
    const law = w.law
      ? el('p', { 'data-line': String(w.law.why) }, '')
      : el('p', {}, 'Keeps the customary hours.');
    if (w.law) {
      law.append(
        el('b', {}, `Work hours: ${w.law.answer}.`),
        ` ${w.law.text} `,
        el('button', { type: 'button', class: 'why', 'data-why': String(w.law.why) }, 'why?'),
      );
    }
    const home = el('p', { 'data-testid': 'home' });
    if (w.home) {
      home.append(el('b', {}, 'Home'), `: ${w.home.text} `);
      if (w.home.why !== undefined)
        home.append(
          el('button', { type: 'button', class: 'why', 'data-why': String(w.home.why) }, 'why?'),
        );
    }
    this.extra.replaceChildren(
      ...(w.home ? [home] : []),
      el('h3', {}, 'The law'),
      law,
      el('h3', {}, 'Warmth line'),
      el('p', {}, w.warmLine.text),
      el('h3', {}, 'Wearing'),
      ...this.wearingRows(w),
      el('h3', {}, 'Memories'),
      ...memories,
      el('h3', {}, 'Tools'),
      ...this.toolRows(w),
    );
  }

  /** A row per garment worn: its slot, "Wool tunic, good", and "by Eadgyth · worn 40% · warms 2°"
   * with a why? to the line that made it; the worker's words. */
  private wearingRows(w: WalkerView): HTMLElement[] {
    if (!w.wearing?.length) return [el('p', { class: 'muted' }, 'Nothing to wear.')];
    return w.wearing.map((r) => {
      const text = el('span', {});
      text.append(el('b', {}, r.text), el('br'), el('small', { class: 'aside' }, r.detail));
      const row = el('div', { class: 'prow wear', 'data-testid': 'wearing-row' });
      row.append(el('b', { class: 'slot' }, r.slot), text);
      if (r.why !== undefined)
        row.append(
          el('button', { type: 'button', class: 'why', 'data-why': String(r.why) }, 'why?'),
        );
      return row;
    });
  }

  private toolRows(w: WalkerView): HTMLElement[] {
    if (!w.tools.length) return [el('p', { class: 'muted' }, 'No tools of their own yet.')];
    const rows = w.tools.map((t) => {
      const go = el('button', { type: 'button', class: 'why', 'data-testid': 'tool' }, t.text);
      go.addEventListener('click', () => this.sources.item(t.id));
      const row = el('div', { class: 'prow' });
      row.append(el('b', {}, t.kind), go);
      return row;
    });
    return [
      ...rows,
      el(
        'p',
        { class: 'aside' },
        'Tools are kept like beds. The best tool of each kind goes to whoever does that work most.',
      ),
    ];
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
    if (w?.stranger) return `S:${JSON.stringify(w.stranger)}`;
    // Levels only: practice moves every few minutes of work, and each redraw replaces the tabs.
    if (this.tab === 'health') return healthKey(w?.health);
    if (this.tab === 'skills') return JSON.stringify(w?.skills.map((s) => s.level));
    if (this.tab === 'work')
      return JSON.stringify(this.sources.work(this.p!, w).map((r) => r.outerHTML));
    if (this.tab === 'ledger') return String(this.mine().at(-1)?.id);
    return '';
  }

  private draw(): void {
    const p = this.p!;
    const w = this.walker();
    this.strangerShown = !!w?.stranger;
    if (w?.stranger) {
      this.drawn = this.key();
      this.panel.showView('person', `${p.name} of ${p.home}`, strangerRows(w.stranger));
      return;
    }
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
    if (this.tab === 'health') fillBlood(this.blood, w?.health);
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
        el('p', {}, `Trade: ${p.trade}${p.known === p.trade ? ` · brought from ${p.home}` : ''}`),
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
    if (this.tab === 'health') {
      const rows = healthBody(p, w?.health, {
        lines: this.sources.lines,
        lineRow: (l) => this.panel.lineRow(l),
        ...(this.sources.hurt && { hurt: this.sources.hurt }),
        ...(this.sources.sicken && { sicken: this.sources.sicken }),
      });
      this.blood = rows.find((r) => r.dataset['testid'] === 'blood');
      return rows;
    }
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
    this.extra.dataset['shown'] = '';
    return [el('p', { class: 'pwho' }, whoLine(p, true)), ...this.rows, this.extra];
  }
}
