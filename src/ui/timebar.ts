// The player's clock in the bar (Phase 6T, V-191): ❚❚, the speed plate ("3× ▾") with its list of
// six speeds, ▸▸ with the Jump ahead tray (Next event, a month, a season, a year, each naming where
// it lands) and, while a jump runs, the jump line: where it lands, a progress bar and Stop. A jump
// that stops early on a Pause line leaves a card with that line, Jump on and Stay here (6T fix A).
// Shows what the worker says (landings, progress, how a jump ended); decides nothing (GAME-02).
import {
  SPEEDS,
  type JumpEndView,
  type JumpSpan,
  type JumpView,
  type LandingsView,
  type Speed,
} from '../worker/index.ts';
import { el } from './dom.ts';

export interface TimeActions {
  setSpeed(speed: Speed): void;
  jump(span: JumpSpan): void;
  /** The tray's "Change what stops play". */
  stops(): void;
  /** The speed list or the tray opened: the ⋯ menu folds. */
  opened(): void;
  /** Stay here, on the card of a jump that stopped early. */
  stay(): void;
}

const SPANS: readonly [JumpSpan, string][] = [
  ['next', 'Next event'],
  ['month', 'A month'],
  ['season', 'A season'],
  ['year', 'A year'],
];

/** "a, b or c". */
const listed = (words: readonly string[]): string =>
  words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)!}`;

const plate = (attrs: Record<string, string>, text: string): HTMLButtonElement =>
  el('button', { type: 'button', ...attrs }, text);

export class TimeBar {
  /** ❚❚, the speed plate and ▸▸, for the bar. */
  readonly group = el('div', { class: 'speeds', role: 'group', 'aria-label': 'Speed' });
  /** The Jump ahead tray, under the bar. */
  readonly tray = el('div', { class: 'tray', 'data-testid': 'jump-tray', hidden: '' });
  /** After a jump stopped early on a Pause line: the line, Jump on and Stay here, under the bar. */
  readonly card = el('div', { class: 'tray stopcard', 'data-testid': 'jump-stopped', hidden: '' });
  private readonly cardLine = el('p', { class: 'stopline' });
  private readonly cardTo = el('small');
  /** The span Jump on sets out on again: it lands where the stopped jump was going. */
  private again: JumpSpan = 'next';
  /** Shown only while a jump runs, in place of the alert line. */
  readonly line = el('div', { class: 'jumpline', 'data-testid': 'jump-line', hidden: '' });
  private readonly pause = plate({ 'aria-label': 'Pause', 'data-testid': 'speed-0' }, '❚❚');
  private readonly plate = plate(
    { class: 'speedplate', 'aria-expanded': 'false', 'data-testid': 'speed-plate' },
    '1× ▾',
  );
  private readonly list = el('div', { class: 'speedlist', 'data-testid': 'speed-list' });
  private readonly items = new Map<Speed, HTMLButtonElement>();
  private readonly open = plate(
    {
      'aria-label': 'Jump ahead',
      'aria-expanded': 'false',
      'aria-pressed': 'false',
      'data-testid': 'jump-open',
    },
    '▸▸▾',
  );
  private readonly lands = new Map<JumpSpan, HTMLElement>();
  private readonly note = el('span');
  private readonly to = el('span', { class: 'to' });
  private readonly track = el('span', { class: 'track' });
  private readonly fill = el('span', { class: 'fill' });
  /** The speed the plate names: the running one, or the last one while paused. */
  private shown: Exclude<Speed, 0> = 1;
  private readonly actions: TimeActions;

  constructor(actions: TimeActions) {
    this.actions = actions;
    this.pause.addEventListener('click', () => actions.setSpeed(0));
    this.plate.addEventListener('click', () => this.fold(this.list.hidden ? 'list' : undefined));
    this.open.addEventListener('click', () => this.fold(this.tray.hidden ? 'tray' : undefined));
    for (const speed of SPEEDS) {
      const b = plate(
        {
          'aria-label': `Speed ${speed}`,
          'data-testid': `speed-${speed}`,
          'aria-pressed': 'false',
        },
        `${speed}×`,
      );
      b.addEventListener('click', () => {
        this.fold();
        actions.setSpeed(speed);
      });
      this.items.set(speed, b);
      this.list.append(b);
    }
    this.list.hidden = true;
    const holder = el('span', { class: 'speedholder' });
    holder.append(this.plate, this.list);
    this.group.append(this.pause, holder, this.open);
    this.drawTray();
    const stop = plate({ class: 'stopbtn', 'data-testid': 'jump-stop' }, 'Stop');
    stop.addEventListener('click', () => actions.setSpeed(0));
    this.track.append(this.fill);
    const words = el('span', { class: 'words' });
    words.append(this.to, this.track);
    this.line.append(words, stop);
    this.drawCard();
  }

  private drawCard(): void {
    const on = plate({ class: 'go jumpon', 'data-testid': 'jump-on' }, '');
    on.append(el('b', {}, 'Jump on'), this.cardTo);
    on.addEventListener('click', () => {
      this.card.hidden = true;
      this.actions.jump(this.again);
    });
    const stay = plate({ 'data-testid': 'jump-stay' }, 'Stay here');
    stay.addEventListener('click', () => {
      this.card.hidden = true;
      this.actions.stay();
    });
    const acts = el('div', { class: 'jumps' });
    acts.append(stay, on);
    this.card.append(el('h2', {}, 'The jump stopped'), this.cardLine, acts);
  }

  private drawTray(): void {
    const close = plate({ 'aria-label': 'Close' }, '✕');
    close.addEventListener('click', () => this.fold());
    const head = el('div', { class: 'trayhead' });
    head.append(el('h2', {}, 'Jump ahead'), close);
    const grid = el('div', { class: 'jumps' });
    for (const [span, name] of SPANS) {
      const land = el('small', {}, span === 'next' ? 'whatever comes first' : '');
      this.lands.set(span, land);
      const b = plate({ class: 'jump', 'data-testid': `jump-${span}` }, '');
      b.append(el('b', {}, name), land);
      b.addEventListener('click', () => {
        this.fold();
        this.actions.jump(span);
      });
      grid.append(b);
    }
    const change = plate({ class: 'link', 'data-testid': 'tray-stops' }, 'Change what stops play');
    change.addEventListener('click', () => {
      this.fold();
      this.actions.stops();
    });
    const about = el('p', { class: 'aside' });
    about.append(this.note, ' ', change);
    this.tray.append(head, grid, about);
  }

  /** A world began or loaded: no stop card from the last one. */
  reset(): void {
    this.card.hidden = true;
  }

  /** Opens the speed list or the tray (closing the other), or folds both. */
  fold(which?: 'list' | 'tray'): void {
    this.list.hidden = which !== 'list';
    this.tray.hidden = which !== 'tray';
    this.plate.setAttribute('aria-expanded', String(which === 'list'));
    this.open.setAttribute('aria-expanded', String(which === 'tray'));
    if (which) this.actions.opened();
  }

  /** The kinds set to Pause, for the tray's note on what ends a jump early. */
  pauseKinds(names: readonly string[]): void {
    const what = names.length
      ? `A jump stops early for ${listed(names.map((n) => n.toLowerCase()))}.`
      : 'Nothing is set to Pause, so a jump runs to its end.';
    this.note.textContent = `Every hour still happens on the way; you just watch it fast. ${what}`;
  }

  show(s: {
    speed: Speed;
    skipping: boolean;
    jump?: JumpView;
    jumpEnd?: JumpEndView;
    landings: LandingsView;
  }): void {
    const { speed, skipping, jump, jumpEnd, landings } = s;
    if (jumpEnd?.line && !jumpEnd.landed) {
      this.again = jumpEnd.span;
      this.cardLine.textContent = jumpEnd.line.text;
      this.cardTo.textContent = `to ${jumpEnd.to}`;
      this.card.hidden = false;
      this.fold();
    } else if (skipping || speed !== 0) this.card.hidden = true;
    if (speed !== 0) this.shown = speed;
    this.pause.setAttribute('aria-pressed', String(!skipping && speed === 0));
    this.plate.setAttribute('aria-pressed', String(!skipping && speed !== 0));
    this.plate.textContent = `${this.shown}× ▾`;
    this.plate.setAttribute('aria-label', `Speed ${this.shown}×, choose a speed`);
    for (const [k, b] of this.items) b.setAttribute('aria-pressed', String(k === this.shown));
    this.open.setAttribute('aria-pressed', String(skipping || !this.tray.hidden));
    for (const span of ['month', 'season', 'year'] as const)
      this.lands.get(span)!.textContent = `to ${landings[span]}`;
    this.line.hidden = !skipping;
    if (!jump) return;
    this.to.textContent =
      jump.span === 'next' ? 'Running to the next event' : `Jumping to ${jump.to}`;
    this.track.hidden = jump.done === undefined;
    this.fill.style.width = `${Math.round((jump.done ?? 0) * 100)}%`;
  }
}
