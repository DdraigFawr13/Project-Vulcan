// The play screen's people and alerts (P2.6): a portrait strip under the bar, each face in an
// iron frame with a mood ring, and the alert line: the newest notable line with a count of those
// not yet read. A face opens that person's sheet and finds them on the map; the Names button at
// the strip's end names everyone on the map (a view aid, never an order). The alert line opens the Alerts sheet, whose
// Show moves the camera to where it happened, never a person (V-015). Notable is the worker's
// word (content `events`), never worked out here (GAME-02).
import type { LedgerLine, PersonView, WalkerView } from '../worker/index.ts';
import { el } from './dom.ts';
import { portrait } from './portrait.ts';

/** The Alerts sheet keeps this many newest alerts. */
const ALERTS = 100;

export interface PlayActions {
  person(p: PersonView): void;
  /** A face was tapped: the camera finds that person. */
  find(p: PersonView): void;
  /** The names button: ring and name everyone on the map, or stop. */
  names(on: boolean): void;
  alerts(): void;
}

export class Play {
  private readonly strip = el('div', { class: 'strip', 'data-testid': 'strip' });
  private readonly plate = el('button', {
    type: 'button',
    class: 'alertplate',
    'data-testid': 'alert',
    hidden: '',
  });
  private readonly names = el('button', {
    type: 'button',
    class: 'namesbtn',
    'data-testid': 'names',
    'aria-pressed': 'false',
  });
  private readonly faces = new Map<number, HTMLElement>();
  private people: readonly PersonView[] = [];
  private list: LedgerLine[] = [];
  private unread = 0;

  constructor(bar: HTMLElement, actions: PlayActions) {
    this.plate.addEventListener('click', () => actions.alerts());
    this.strip.addEventListener('click', (e) => {
      const id = Number(
        (e.target as HTMLElement).closest<HTMLElement>('[data-person]')?.dataset['person'],
      );
      const p = this.people.find((x) => x.id === id);
      if (!p) return;
      actions.person(p);
      actions.find(p);
    });
    this.names.textContent = 'Names';
    this.names.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = this.names.getAttribute('aria-pressed') !== 'true';
      this.names.setAttribute('aria-pressed', String(on));
      actions.names(on);
    });
    bar.append(this.strip, this.plate);
  }

  /** The colony, as the world began or loaded: a face for each, not for strangers (P5.9), who
   * are on the map and open from there. `keep` holds the alerts when someone came or left. */
  setPeople(people: readonly PersonView[], keep = false): void {
    this.people = people;
    this.faces.clear();
    const faces = people.filter((p) => p.status !== 'stranger');
    this.strip.replaceChildren(
      ...faces.map((p) => {
        const slot = el('button', {
          type: 'button',
          class: 'pslot',
          'data-person': String(p.id),
          'aria-label': p.name,
          'data-name': p.name,
        });
        const face = el('span', { class: 'face' });
        face.append(portrait(p, 40 / 32, true));
        slot.append(
          face,
          el('span', { class: 'hbadge', 'aria-hidden': 'true', hidden: '' }),
          el('span', { class: 'pname' }, p.name.split(' ')[0]!),
        );
        this.faces.set(p.id, slot);
        return slot;
      }),
      this.names,
    );
    this.strip.hidden = !faces.length;
    if (keep) return;
    this.list = [];
    this.unread = 0;
    this.showPlate();
  }

  /** Mood rings from this snapshot: green content, amber under the warning line, red at the worst. */
  setWalkers(walkers: readonly WalkerView[]): void {
    for (const w of walkers) {
      const slot = this.faces.get(w.id);
      if (!slot) continue;
      slot.classList.toggle('low', w.mood.low && w.mood.share >= 20);
      slot.classList.toggle('bad', w.mood.low && w.mood.share < 20);
      // Hurt: a red "+"; dead until buried: a greyed face and a "†"; the buried leave (P5.6, P5.8).
      const badge = w.health?.badge;
      slot.hidden = !!w.health?.buried;
      slot.classList.toggle('hurt', badge === 'hurt');
      slot.classList.toggle('dead', badge === 'dead');
      const mark = slot.querySelector<HTMLElement>('.hbadge');
      if (mark) {
        mark.hidden = !badge;
        mark.textContent = badge === 'dead' ? '†' : '+';
      }
      const state = badge === 'dead' ? 'dead' : badge === 'hurt' ? 'hurt' : w.mood.word;
      slot.setAttribute('aria-label', `${slot.dataset['name'] ?? ''}, ${state}`);
    }
  }

  /** The person whose sheet is open is ringed in ember. */
  select(id: number | undefined): void {
    for (const [k, slot] of this.faces) slot.classList.toggle('sel', k === id);
  }

  /** New ledger lines: the notable ones become alerts, unread unless the world just loaded. */
  addLines(lines: readonly LedgerLine[], unread = true): void {
    const fresh = lines.filter((l) => l.notable);
    if (!fresh.length) return;
    this.list = [...fresh.reverse(), ...this.list].slice(0, ALERTS);
    if (unread) this.unread += fresh.length;
    this.showPlate();
  }

  /** Alerts newest first; reading them clears the count. */
  read(): readonly LedgerLine[] {
    this.unread = 0;
    this.showPlate();
    return this.list;
  }

  private showPlate(): void {
    const top = this.list[0];
    this.plate.hidden = !top;
    if (!top) return;
    const text = el('span', { class: 'txt' }, el('b', {}, top.text));
    if (top.where) text.append(` · ${top.where.words}`);
    this.plate.replaceChildren(text);
    if (this.unread)
      this.plate.append(el('span', { class: 'count' }, String(Math.min(this.unread, 99))));
    this.plate.setAttribute('aria-label', `Alerts: ${top.text}`);
  }
}
