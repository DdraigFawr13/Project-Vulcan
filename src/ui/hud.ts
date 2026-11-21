// The heads-up display over the map: clock, speed and panel buttons (the lit pause plate says the
// game is paused, with no word, per the taste board), the tile readout, level and zoom buttons, a
// debug line, and the starting, loading and error screens. Shows what it is given; it computes no
// game rule (GAME-02).
import type {
  ClockView,
  JumpEndView,
  JumpSpan,
  JumpView,
  LandingsView,
  MoodView,
  Speed,
  TimingView,
  WeatherView,
} from '../worker/index.ts';
import { el } from './dom.ts';
import { TimeBar } from './timebar.ts';
import { versionTag } from './version.ts';

/** The panels the bar opens. */
export type PanelButton =
  'ledger' | 'work' | 'build' | 'laws' | 'stock' | 'saves' | 'region' | 'dawn' | 'mood' | 'stops';

export interface HudActions {
  setSpeed(speed: Speed): void;
  /** Jump ahead (V-191): to the next Pause or Slow line, or a month, a season or a year. */
  jump(span: JumpSpan): void;
  zoom(direction: 1 | -1): void;
  /** One level down (1) or up (-1). */
  level(direction: 1 | -1): void;
  reload(): void;
  /** Opens a panel, or closes it if it is the one showing. */
  togglePanel(kind: PanelButton): void;
  /** The player closed a screen with its "dismiss" button. */
  dismissed(): void;
  /** Stay here, after a jump stopped early: the recaps it passed wait in the Chronicle. */
  stay(): void;
}

export class Hud {
  private readonly clock = el('div', { class: 'clock', 'data-testid': 'clock' });
  /** The build's version, quiet at the end of the clock's second line. */
  private readonly version = versionTag();
  /** The colony's mood in a word (P6.6), after the season under the clock; opens its causes. */
  private readonly mood = el('button', {
    type: 'button',
    class: 'moodword',
    'data-testid': 'mood',
    hidden: '',
  });
  /** ❚❚, the speed plate and ▸▸ with its tray, and the jump line (V-191). */
  readonly time: TimeBar;
  private readonly panels = new Map<PanelButton, HTMLButtonElement>();
  private readonly readout = el('div', { class: 'hud readout', hidden: '' });
  /** fps and tick, for developers only (`?debug` in the URL); the smoke reads its data fields. */
  private readonly debug = el('div', { class: 'hud debug', 'data-testid': 'debug', hidden: '' });
  /** The bar along the top; the camera keeps the map clear of it. */
  readonly bar = el('div', { class: 'hud bar' });
  private readonly screen = el('div', { class: 'screen' });
  private readonly levelLabel = el('span', { class: 'level', 'data-testid': 'level' }, 'S');
  private readonly up = el('button', { type: 'button', 'aria-label': 'Level up' }, '▲');
  private readonly down = el('button', { type: 'button', 'aria-label': 'Level down' }, '▼');
  private readonly unreached = el('div', {
    class: 'unreached',
    'data-testid': 'unreached',
    hidden: '',
  });
  /** The ⋯ menu and its button (folded on a phone only). */
  private menu!: { root: HTMLElement; button: HTMLButtonElement };
  /** "surface" or "2 levels down", after the season under the clock. */
  private where = 'surface';
  private timing = '';
  /** Frames per second the renderer measured, shown on the debug line. */
  fps = 0;

  /** Test mode is on: the bar says so beside the clock. */
  private readonly testMode: boolean;

  constructor(root: HTMLElement, actions: HudActions, debug = false) {
    const bar = this.bar;
    this.testMode = debug;
    // iOS Safari applies :active (the pressed plate) only when the page listens for touches.
    document.addEventListener('touchstart', () => {}, { passive: true });
    this.debug.hidden = !debug;
    const { setSpeed, jump, stay } = actions;
    const stops = () => actions.togglePanel('stops');
    this.time = new TimeBar({ setSpeed, jump, stay, stops, opened: () => this.showMenu(false) });
    const group = this.time.group;
    this.mood.addEventListener('click', () => actions.togglePanel('mood'));
    // Ledger stays in the bar; the rest fold under ⋯ on a phone (UI_STYLE.md) and sit in the bar on
    // a desktop, where the menu is laid out inline.
    const panels = el('div', { class: 'speeds', role: 'group', 'aria-label': 'Panels' });
    const menu = el('div', { class: 'menu', 'data-testid': 'menu' });
    const more = el(
      'button',
      { type: 'button', class: 'more', 'aria-label': 'More', 'aria-expanded': 'false' },
      '⋯',
    );
    more.addEventListener('click', () => this.showMenu(!menu.classList.contains('open')));
    for (const [kind, label] of [
      ['ledger', 'Ledger'],
      ['work', 'Work'],
      ['build', 'Build'],
      ['laws', 'Laws'],
      ['stock', 'Stock'],
      ['region', 'Region'],
      ['dawn', 'Yesterday'],
      ['stops', 'Stops'],
      ['saves', 'Saves'],
    ] as const) {
      const button = el(
        'button',
        { type: 'button', class: 'word', 'aria-pressed': 'false', 'data-testid': `open-${kind}` },
        label,
      );
      if (kind === 'stops') button.setAttribute('aria-label', 'What stops play');
      button.addEventListener('click', () => {
        this.showMenu(false);
        actions.togglePanel(kind);
      });
      this.panels.set(kind, button);
      (kind === 'ledger' ? panels : menu).append(button);
    }
    panels.append(more, menu);
    this.menu = { root: menu, button: more };
    const status = el('div', { class: 'status' });
    status.append(group, panels);
    bar.append(this.clock, status, this.time.line, this.time.tray, this.time.card);
    const zoom = el('div', { class: 'hud zoom' });
    this.up.addEventListener('click', () => actions.level(-1));
    this.down.addEventListener('click', () => actions.level(1));
    zoom.append(this.up, this.levelLabel, this.down);
    for (const [label, direction] of [
      ['+', 1],
      ['−', -1],
    ] as const) {
      const button = el(
        'button',
        { type: 'button', 'aria-label': direction > 0 ? 'Zoom in' : 'Zoom out' },
        label,
      );
      button.addEventListener('click', () => actions.zoom(direction));
      zoom.append(button);
    }
    this.screen.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).dataset['action'];
      if (action === 'reload') actions.reload();
      else if (action === 'dismiss') {
        this.hideScreen();
        actions.dismissed();
      }
    });
    root.append(this.unreached, bar, this.readout, zoom, this.debug, this.screen);
    this.showScreen('Waking the valley', 'Making the world and its 250 years of history.');
  }

  showClock(s: {
    clock: ClockView;
    tick: number;
    speed: Speed;
    at: number;
    weather?: WeatherView;
    skipping?: boolean;
    mood?: MoodView;
    jump?: JumpView;
    jumpEnd?: JumpEndView;
    landings: LandingsView;
  }): void {
    const { clock, tick, at, weather, mood } = s;
    const pad = (n: number) => String(n).padStart(2, '0');
    const season = clock.season.charAt(0).toUpperCase() + clock.season.slice(1);
    const sky = weather ? ` · ${weather.words}, ${weather.temperature} °C` : '';
    this.clock.replaceChildren(
      el('span', { class: 'time' }, `${pad(clock.hour)}:${pad(clock.minute)}`),
      ` · Day ${clock.day} of ${clock.monthName}, Year ${clock.year}`,
    );
    if (this.testMode)
      this.clock.append(
        el('span', { class: 'testbadge', 'data-testid': 'test-badge' }, 'TEST MODE'),
      );
    const line = el('small', {}, `${season}${sky} · ${this.where}`);
    line.prepend(this.version);
    if (mood) {
      this.mood.hidden = false;
      this.mood.dataset['rank'] = String(mood.rank);
      this.mood.textContent = mood.word;
      this.mood.setAttribute('aria-label', `The colony's mood: ${mood.word}`);
      line.append(' · ', this.mood);
    }
    this.clock.append(line);
    this.time.show({ ...s, skipping: s.skipping ?? false });
    this.bar.classList.toggle('jumping', s.skipping ?? false);
    this.debug.dataset['tick'] = String(tick);
    this.debug.dataset['at'] = String(Math.round(at));
    this.debug.textContent = `${this.fps} fps · tick ${tick}${this.timing}`;
  }

  /** The worker's tick timing for the debug line (P2.0): mean and p95 ms, and the slowest system. */
  showTiming(t: TimingView): void {
    // Ticks take microseconds before colonists arrive; the browser's clock is coarse below 0.1 ms.
    const ms = (n: number) => n.toFixed(3);
    const slowest = t.slowestMs > 0 ? ` · slowest ${t.slowest} ${ms(t.slowestMs)}` : '';
    this.timing = t.slowest ? ` · ${ms(t.mean)} ms/tick, p95 ${ms(t.p95)}${slowest}` : '';
  }

  showTile(tile: { x: number; y: number; ground: string } | undefined): void {
    this.readout.hidden = !tile;
    if (tile)
      this.readout.replaceChildren(
        'Tile ',
        el('b', {}, `${tile.x}, ${tile.y}`),
        ` · ${tile.ground}`,
      );
  }

  /** Level `z` of `depth` is on screen (0 the surface); `reached` says which levels below have
   * tiles. The level plates are normal view buttons once any shaft or stairs exist on the map (so
   * some level below is reached); until then only test mode shows them (its tools make the first). */
  showLevel(z: number, depth: number, reached: readonly boolean[]): void {
    this.where = z === 0 ? 'surface' : `${z} level${z > 1 ? 's' : ''} down`;
    this.levelLabel.textContent = z === 0 ? 'S' : `−${z}`;
    this.up.disabled = z === 0;
    this.down.disabled = z >= depth;
    for (const e of [this.up, this.levelLabel, this.down])
      e.hidden = !(this.testMode || reached.some(Boolean));
    this.unreached.hidden = z === 0 || reached[z - 1] === true;
    this.unreached.replaceChildren(
      el('b', {}, 'Not reached yet'),
      el(
        'span',
        {},
        `Nothing has been dug down this far. Stairs or a shaft will open level ${z} the first time they reach it.`,
      ),
    );
  }

  /** Opens or folds the ⋯ menu. */
  showMenu(open: boolean): void {
    if (open) this.time.fold();
    this.menu.root.classList.toggle('open', open);
    this.menu.button.setAttribute('aria-expanded', String(open));
  }

  /** Marks which panel is open on its button. */
  showPanel(kind: string | undefined): void {
    for (const [k, button] of this.panels) button.setAttribute('aria-pressed', String(k === kind));
    // On a phone a folded panel's button is out of sight, so ⋯ shows it is open.
    this.menu.button.setAttribute(
      'aria-pressed',
      String(
        kind === 'work' ||
          kind === 'build' ||
          kind === 'laws' ||
          kind === 'dawn' ||
          kind === 'stock' ||
          kind === 'region' ||
          kind === 'saves' ||
          kind === 'stops' ||
          kind === 'mood',
      ),
    );
  }

  hideScreen(): void {
    this.screen.hidden = true;
  }

  /** The engine stopped; `kept` names the day the rescue save holds, once it is written. */
  showError(message: string, kept?: string): void {
    const rescue = kept ? ` Your game up to ${kept} is kept as a rescue save in Saves.` : '';
    this.showScreen('The simulation stopped', `${message}${rescue}`, ['Reload', 'reload']);
  }

  /** A screen over the game; the optional button reloads the page or just closes the screen. */
  showScreen(title: string, detail: string, button?: [string, 'reload' | 'dismiss']): void {
    this.screen.replaceChildren(el('b', {}, title), el('span', {}, detail));
    if (button)
      this.screen.append(el('button', { type: 'button', 'data-action': button[1] }, button[0]));
    this.screen.hidden = false;
  }
}
