// What stops play (Phase 6T, V-191): a row per stop kind (content `stops`) with Pause, Slow and
// Note. The choice is kept on this device (`localStorage`), so it holds for every game, and goes to
// the worker as a setting of the clock, never a game command (V-041). Pause stops the game, Slow
// drops it to 1× and leaves it there, Note only adds the line to the alerts.
import { content } from '../content/index.ts';
import type { StopAct, StopSettings } from '../worker/index.ts';
import { el } from './dom.ts';
import type { Panel } from './panel.ts';

const KEY = 'vulcan.stops';
const ACTS: readonly [StopAct, string][] = [
  ['pause', 'Pause'],
  ['slow', 'Slow'],
  ['note', 'Note'],
];

/** The settings in force on this device: the content defaults with the player's choices. */
function load(): Record<string, StopAct> {
  const all = Object.fromEntries(content.stops.map((s) => [s.id, s.default as StopAct]));
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    for (const s of content.stops) {
      const v = kept[s.id];
      if (v === 'pause' || v === 'slow' || v === 'note') all[s.id] = v;
    }
  } catch {
    // storage blocked or the kept value spoilt: the defaults stand
  }
  return all;
}

export class Stops {
  private settings = load();
  private readonly panel: Panel;
  private readonly changed: (stops: StopSettings, pauseWords: string[]) => void;
  /** Rows under the kinds: the recap switches (V-191). */
  more: () => HTMLElement[] = () => [];

  /** `changed` is told the settings, and the kinds set to Pause in words (for the jump tray's
   * note), at once and after each change. */
  constructor(panel: Panel, changed: (stops: StopSettings, pauseWords: string[]) => void) {
    this.panel = panel;
    this.changed = changed;
    this.tell();
  }

  private tell(): void {
    const pause = content.stops.filter((s) => this.settings[s.id] === 'pause').map((s) => s.name);
    this.changed(this.settings, pause);
  }

  show(): void {
    const intro = el(
      'p',
      { class: 'aside' },
      'Pause stops the game. Slow drops it to 1× and leaves it there. Note only puts the line in the alerts. Next event stops for Pause or Slow; a month, a season or a year stops early only for Pause.',
    );
    const rows = content.stops.map((s) => {
      const row = el('div', { class: 'stoprow', 'data-testid': `stop-${s.id}` });
      const words = el('div', { class: 'stopwords' }, el('b', {}, s.name));
      words.append(el('small', {}, s.hint));
      const acts = el('div', { class: 'stopacts', role: 'group', 'aria-label': s.name });
      for (const [act, label] of ACTS) {
        const b = el(
          'button',
          {
            type: 'button',
            'aria-pressed': String(this.settings[s.id] === act),
            'data-testid': `stop-${s.id}-${act}`,
          },
          label,
        );
        b.addEventListener('click', () => {
          this.set(s.id, act);
          for (const other of acts.children)
            other.setAttribute('aria-pressed', String(other === b));
        });
        acts.append(b);
      }
      row.append(words, acts);
      return row;
    });
    this.panel.showView('stops', 'What stops play', [intro, ...rows, ...this.more()]);
  }

  private set(kind: string, act: StopAct): void {
    this.settings = { ...this.settings, [kind]: act };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      // storage blocked: the choice holds for this game only
    }
    this.tell();
  }
}
