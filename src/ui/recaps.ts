// Season and year recaps on screen (Phase 6T slice 3, V-191). With a recap's switch on, a season's
// turn at a running speed pauses (the worker does) and the recap page opens; Carry on resumes at the
// speed it ran at. A jump runs on and, as it lands, shows the newest recap it passed, so a year jump
// shows only the year's (it replaces winter's). Every recap is listed in the Ledger's Chronicle tab.
// A jump that stops early on a Pause line holds what it passed while its stop card asks Jump on or
// Stay here (6T fix A): they open only if the jump lands, and otherwise wait in the Chronicle.
// The two switches are kept on this device, and go to the worker as a clock setting (V-041).
// Shows; decides nothing (GAME-02).
import type { JumpEndView, RecapSettings, RecapView, Speed, ToWorker } from '../worker/index.ts';
import { el } from './dom.ts';
import type { Panel } from './panel.ts';

const KEY = 'vulcan.recaps';

/** The switches on this device: both on unless the player turned one off. */
export function loadRecaps(): RecapSettings {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return { season: kept['season'] !== false, year: kept['year'] !== false };
  } catch {
    return { season: true, year: true }; // storage blocked or spoilt: the defaults stand
  }
}

/** Of the recaps a run or a jump just passed, the one to open: the newest year recap if year
 * recaps are on, else the newest season recap if season recaps are on. */
export function recapToShow(
  passed: readonly RecapView[],
  on: RecapSettings,
): RecapView | undefined {
  const newest = (kind: RecapView['kind']) => passed.filter((r) => r.kind === kind).at(-1);
  return (on.year ? newest('year') : undefined) ?? (on.season ? newest('season') : undefined);
}

/** Recaps passed and not yet shown, and whether the jump that passed them stopped early: then they
 * wait while the game stays paused at the stop card. */
export interface Held {
  passed: RecapView[];
  stopped: boolean;
}

/** As a snapshot arrives, the recap to open now, if any. A jump holds every recap it passes. One
 * that lands opens the newest (`recapToShow`). One that stopped early on a Pause line keeps them
 * while play stays paused, since Jump on may yet land it; once play runs on without it they go
 * straight to the Chronicle, as they do when the player stops a jump. At a running speed a turn
 * opens its recap at once. */
export function recapNow(
  held: Held,
  m: { speed: Speed; skipping: boolean; jumpEnd?: JumpEndView },
  on: RecapSettings,
): RecapView | undefined {
  if (m.skipping) return undefined;
  if (m.jumpEnd && !m.jumpEnd.landed) {
    held.stopped = m.jumpEnd.line !== undefined;
    if (!held.stopped) held.passed = [];
    return undefined;
  }
  if (held.stopped && !m.jumpEnd) {
    if (m.speed === 0) return undefined;
    [held.passed, held.stopped] = [[], false];
    return undefined;
  }
  const shown = recapToShow(held.passed, on);
  [held.passed, held.stopped] = [[], false];
  return shown;
}

/** The speed Carry on resumes at: the one play ran at before the turn paused it, none after a jump
 * (a jump ends paused) or when play was already paused. */
export const resumeAt = (before: { speed: Speed; skipping: boolean }): Speed =>
  before.skipping ? 0 : before.speed;

export interface RecapDeps {
  panel: Panel;
  send(message: ToWorker): void;
  /** Sets the speed, as the bar does. */
  speed(speed: Speed): void;
  /** A page opened from here: the bar presses `kind`'s button, or none. */
  opened(kind?: string): void;
}

export class Recaps {
  /** Every recap of this world, oldest first. */
  private all: RecapView[] = [];
  /** Recaps passed while jumping, shown as it lands. */
  private readonly held: Held = { passed: [], stopped: false };
  /** A world just began or loaded: its first recaps are not news. */
  private fresh = true;
  private before: { speed: Speed; skipping: boolean } = { speed: 0, skipping: false };
  private on = loadRecaps();
  private readonly deps: RecapDeps;

  constructor(deps: RecapDeps) {
    this.deps = deps;
    deps.send({ type: 'setRecaps', recaps: this.on });
  }

  reset(): void {
    [this.all, this.held.passed, this.held.stopped, this.fresh] = [[], [], false, true];
  }

  /** Stay here, on the card of a jump that stopped early: what it passed waits in the Chronicle. */
  stay(): void {
    [this.held.passed, this.held.stopped] = [[], false];
  }

  /** Each snapshot, before the dawn page: true when a recap opened, so the dawn page holds back. */
  snapshot(m: {
    annals?: RecapView[];
    speed: Speed;
    skipping: boolean;
    jumpEnd?: JumpEndView;
  }): boolean {
    const before = this.before;
    this.before = { speed: m.speed, skipping: m.skipping };
    if (m.annals) {
      this.all.push(...m.annals);
      if (!this.fresh) this.held.passed.push(...m.annals);
      this.fresh = false;
    }
    const shown = recapNow(this.held, m, this.on);
    if (!shown) return false;
    this.show(shown, resumeAt(before));
    return true;
  }

  /** The recap page: at its turn with Turn off recaps and Carry on (resuming at `resume`), or from
   * the Chronicle with Back to the Chronicle. */
  show(r: RecapView, resume?: Speed): void {
    const { panel } = this.deps;
    const rows: HTMLElement[] = [el('h3', { class: 'recaptitle' }, r.title)];
    for (const s of r.sections) {
      if (s.head) rows.push(el('h4', {}, s.head));
      const p = el('p', { 'data-section': s.id }, s.sentences.map((t) => t.text).join(' '));
      rows.push(p);
      const lines = [...new Map(s.sentences.flatMap((t) => t.lines).map((l) => [l.id, l]))];
      if (!lines.length) continue;
      const cited = el('div', { class: 'cited', 'data-testid': 'recap-cited', hidden: '' });
      cited.append(...lines.map(([, l]) => panel.lineRow(l)));
      const why = el(
        'button',
        { type: 'button', class: 'why', 'data-testid': 'recap-why' },
        'why?',
      );
      why.addEventListener('click', () => void (cited.hidden = !cited.hidden));
      p.append(' ', why);
      rows.push(cited);
    }
    const foot = el('div', { class: 'row recapfoot' });
    if (resume === undefined) {
      const back = el(
        'button',
        { type: 'button', 'data-testid': 'recap-back' },
        'Back to the Chronicle',
      );
      back.addEventListener('click', () => {
        panel.showLedger(undefined, 'chronicle');
        this.deps.opened('ledger');
      });
      foot.append(back);
    } else {
      rows.push(el('p', { class: 'aside' }, 'Every recap stays in the Ledger, under Chronicle.'));
      foot.append(
        this.button('Turn off recaps', 'recap-off', resume, false),
        this.button('Carry on', 'recap-carry', resume, true),
      );
    }
    panel.showView('recap', r.kicker, [...rows, foot]);
    this.deps.opened();
  }

  private button(label: string, id: string, resume: Speed, keep: boolean): HTMLButtonElement {
    const b = el('button', { type: 'button', 'data-testid': id, class: keep ? 'go' : '' }, label);
    b.addEventListener('click', () => {
      if (!keep) this.set({ season: false, year: false });
      this.deps.panel.close();
      if (resume !== 0) this.deps.speed(resume);
    });
    return b;
  }

  /** The Ledger's Chronicle tab: every recap, newest first, each opening its page. */
  chronicle(): HTMLElement[] {
    if (!this.all.length)
      return [
        el('p', { class: 'empty' }, 'No recaps yet. The first is written as the season turns.'),
      ];
    return [...this.all].reverse().map((r) => {
      const b = el('button', { type: 'button', class: 'annal', 'data-testid': 'chronicle-entry' });
      b.append(el('small', {}, r.kicker), el('b', {}, r.title));
      b.addEventListener('click', () => this.show(r));
      return b;
    });
  }

  /** The two switches for the What stops play sheet. */
  rows(): HTMLElement[] {
    const head = el('h3', {}, 'Recaps');
    const about = el(
      'p',
      { class: 'aside' },
      'On, the turn of a season or a year pauses the game and opens its recap. Off, it goes straight to the Chronicle.',
    );
    const row = (kind: keyof RecapSettings, name: string) => {
      const r = el('div', { class: 'recaprow', 'data-testid': `recaps-${kind}` });
      r.append(el('div', { class: 'stopwords' }, el('b', {}, name)));
      const acts = el('div', { class: 'stopacts', role: 'group', 'aria-label': name });
      for (const [value, label] of [
        [true, 'On'],
        [false, 'Off'],
      ] as const) {
        const b = el(
          'button',
          {
            type: 'button',
            'aria-pressed': String(this.on[kind] === value),
            'data-testid': `recaps-${kind}-${label.toLowerCase()}`,
          },
          label,
        );
        b.addEventListener('click', () => {
          this.set({ ...this.on, [kind]: value });
          for (const other of acts.children)
            other.setAttribute('aria-pressed', String(other === b));
        });
        acts.append(b);
      }
      r.append(acts);
      return r;
    };
    return [head, about, row('season', 'Season recaps'), row('year', 'Year recaps')];
  }

  private set(on: RecapSettings): void {
    this.on = on;
    try {
      localStorage.setItem(KEY, JSON.stringify(on));
    } catch {
      // storage blocked: the choice holds for this game only
    }
    this.deps.send({ type: 'setRecaps', recaps: on });
  }
}
