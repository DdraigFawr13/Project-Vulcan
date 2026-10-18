// The heads-up display over the map: clock, speed and panel buttons (the lit pause plate says the
// game is paused, with no word, per the taste board), the tile readout, level and zoom buttons, a
// debug line, and the starting, loading and error screens. Shows what it is given; it computes no
// game rule (GAME-02).
import type { ClockView, Speed, TimingView, WeatherView } from '../worker/index.ts';
import { el } from './dom.ts';

/** The panels the bar opens. */
export type PanelButton = 'ledger' | 'work' | 'stock' | 'saves' | 'region';

const SPEED_LABELS: Record<Speed, string> = { 0: '❚❚', 1: '1×', 2: '2×', 3: '3×' };

export interface HudActions {
  setSpeed(speed: Speed): void;
  /** Skip ahead to the next notable line (P2.7). */
  skip(): void;
  zoom(direction: 1 | -1): void;
  /** One level down (1) or up (-1). */
  level(direction: 1 | -1): void;
  reload(): void;
  /** Opens a panel, or closes it if it is the one showing. */
  togglePanel(kind: PanelButton): void;
  /** The player closed a screen with its "dismiss" button. */
  dismissed(): void;
}

export class Hud {
  private readonly clock = el('div', { class: 'clock', 'data-testid': 'clock' });
  private readonly speeds = new Map<Speed, HTMLButtonElement>();
  /** Skip ahead (P2.7), lit while a skip runs. */
  private readonly skip = el(
    'button',
    {
      type: 'button',
      'aria-label': 'Skip ahead',
      'aria-pressed': 'false',
      'data-testid': 'speed-skip',
    },
    '▸▸',
  );
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
    const group = el('div', { class: 'speeds', role: 'group', 'aria-label': 'Speed' });
    for (const speed of [0, 1, 2, 3] as const) {
      const label = speed === 0 ? 'Pause' : `Speed ${speed}`;
      const button = el(
        'button',
        { type: 'button', 'aria-label': label, 'data-testid': `speed-${speed}` },
        SPEED_LABELS[speed],
      );
      button.addEventListener('click', () => actions.setSpeed(speed));
      this.speeds.set(speed, button);
      group.append(button);
    }
    this.skip.addEventListener('click', () => actions.skip());
    group.append(this.skip);
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
      ['stock', 'Stock'],
      ['region', 'Region'],
      ['saves', 'Saves'],
    ] as const) {
      const button = el(
        'button',
        { type: 'button', class: 'word', 'aria-pressed': 'false', 'data-testid': `open-${kind}` },
        label,
      );
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
    bar.append(this.clock, status);
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

  showClock(
    clock: ClockView,
    tick: number,
    speed: Speed,
    at: number,
    weather?: WeatherView,
    skipping = false,
  ): void {
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
    this.clock.append(el('small', {}, `${season}${sky} · ${this.where}`));
    for (const [s, button] of this.speeds)
      button.setAttribute('aria-pressed', String(!skipping && s === speed));
    this.skip.setAttribute('aria-pressed', String(skipping));
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

  /** Level `z` of `depth` is on screen (0 the surface); `reached` says whether it has tiles. */
  showLevel(z: number, depth: number, reached: boolean): void {
    this.where = z === 0 ? 'surface' : `${z} level${z > 1 ? 's' : ''} down`;
    this.levelLabel.textContent = z === 0 ? 'S' : `−${z}`;
    this.up.disabled = z === 0;
    this.down.disabled = z >= depth;
    this.unreached.hidden = reached;
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
    this.menu.root.classList.toggle('open', open);
    this.menu.button.setAttribute('aria-expanded', String(open));
  }

  /** Marks which panel is open on its button. */
  showPanel(kind: string | undefined): void {
    for (const [k, button] of this.panels) button.setAttribute('aria-pressed', String(k === kind));
    // On a phone a folded panel's button is out of sight, so ⋯ shows it is open.
    this.menu.button.setAttribute(
      'aria-pressed',
      String(kind === 'work' || kind === 'stock' || kind === 'region' || kind === 'saves'),
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
