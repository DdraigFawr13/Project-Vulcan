// The play screen's people and alerts (P2.6): a portrait strip under the bar, each face in an
// iron frame with a mood ring, and the alert line: the newest notable line with a count of those
// not yet read. A face opens that person's sheet; the alert line opens the Alerts sheet, whose
// Show moves the camera to where it happened, never a person (V-015). Notable is the worker's
// word (content `events`), never worked out here (GAME-02).
import type { LedgerLine, PersonView, WalkerView } from '../worker/index.ts';
import { el } from './dom.ts';
import { portrait } from './portrait.ts';

/** The Alerts sheet keeps this many newest alerts. */
const ALERTS = 100;

export interface PlayActions {
  person(p: PersonView): void;
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
      if (p) actions.person(p);
    });
    bar.append(this.strip, this.plate);
  }

  /** The band, as the world began or loaded: a face for each. */
  setPeople(people: readonly PersonView[]): void {
    this.people = people;
    this.faces.clear();
    this.strip.replaceChildren(
      ...people.map((p) => {
        const slot = el('button', {
          type: 'button',
          class: 'pslot',
          'data-person': String(p.id),
          'aria-label': p.name,
          'data-name': p.name,
        });
        const face = el('span', { class: 'face' });
        face.append(portrait(p, 40 / 32));
        slot.append(face, el('span', { class: 'pname' }, p.name.split(' ')[0]!));
        this.faces.set(p.id, slot);
        return slot;
      }),
    );
    this.strip.hidden = !people.length;
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
      slot.setAttribute('aria-label', `${slot.dataset['name'] ?? ''}, ${w.mood.word}`);
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
