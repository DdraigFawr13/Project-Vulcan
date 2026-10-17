// The heads-up display over the map: clock, speed buttons, the Paused label, the tile readout,
// zoom buttons, a debug line, and the starting and error screens. Shows what it is given; it
// computes no game rule (GAME-02).
import type { ClockView, Speed } from '../worker/index.ts';

const SPEED_LABELS: Record<Speed, string> = { 0: '❚❚', 1: '1×', 2: '2×', 3: '3×' };

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text = '',
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.textContent = text;
  return node;
};

export interface HudActions {
  setSpeed(speed: Speed): void;
  zoom(direction: 1 | -1): void;
  reload(): void;
}

export class Hud {
  private readonly clock = el('div', { class: 'clock', 'data-testid': 'clock' });
  private readonly paused = el('span', { class: 'pill', hidden: '' }, 'Paused');
  private readonly speeds = new Map<Speed, HTMLButtonElement>();
  private readonly readout = el('div', { class: 'hud readout', hidden: '' });
  private readonly debug = el('div', { class: 'hud debug', 'data-testid': 'debug' });
  private readonly screen = el('div', { class: 'screen' });
  /** Frames per second the renderer measured, shown on the debug line. */
  fps = 0;

  constructor(root: HTMLElement, actions: HudActions) {
    const bar = el('div', { class: 'hud bar' });
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
    const status = el('div', { class: 'status' });
    status.append(this.paused, group);
    bar.append(this.clock, status);
    const zoom = el('div', { class: 'hud zoom' });
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
      if ((e.target as HTMLElement).dataset['action'] === 'reload') actions.reload();
    });
    root.append(bar, this.readout, zoom, this.debug, this.screen);
    this.showScreen('Waking the valley', 'Loading the content and laying out the map.');
  }

  showClock(clock: ClockView, tick: number, speed: Speed): void {
    const pad = (n: number) => String(n).padStart(2, '0');
    const season = clock.season.charAt(0).toUpperCase() + clock.season.slice(1);
    this.clock.textContent = `${pad(clock.hour)}:${pad(clock.minute)} · Day ${clock.day} of ${clock.monthName}, Year ${clock.year}`;
    this.clock.append(el('small', {}, season));
    this.paused.hidden = speed !== 0;
    for (const [s, button] of this.speeds) button.setAttribute('aria-pressed', String(s === speed));
    this.debug.dataset['tick'] = String(tick);
    this.debug.textContent = `${this.fps} fps · tick ${tick}`;
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

  hideScreen(): void {
    this.screen.hidden = true;
  }

  showError(message: string): void {
    this.showScreen('The simulation stopped', message, 'Reload');
  }

  private showScreen(title: string, detail: string, button?: string): void {
    this.screen.replaceChildren(el('b', {}, title), el('span', {}, detail));
    if (button)
      this.screen.append(el('button', { type: 'button', 'data-action': 'reload' }, button));
    this.screen.hidden = false;
  }
}
