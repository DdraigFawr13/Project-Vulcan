// The Build sheet (P3.7): what the colony needs built. The player sets how much it wants houses
// (the Work sheet's 1 to 4 stepper) and may send the current plan back once; the colony chooses
// where a house goes, how big and why (V-049), so nothing here picks a tile or a person. Levers
// apply at once while paused and show as sent until the snapshot carries them. Everything shown
// comes from the worker's `BuildView` (GAME-02).
import type { BuildRow, BuildView } from '../worker/index.ts';
import { el } from './dom.ts';
import { stepper, WORDS } from './stepper.ts';

export interface BuildActions {
  setBuild(level: number): void;
  sendBack(house: number): void;
  /** The sheet changed on its own (a lever sent): draw it again. */
  refresh(): void;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "Cottage, 4 beds, west of the green: planned. 0 of 75 stone and 0 of 20 logs here." */
function planLine(h: BuildRow): HTMLElement {
  const p = el('p', { 'data-testid': 'build-plan' });
  p.append(el('b', {}, cap(h.name)), `, ${h.beds} beds, ${h.dir} of the green: `);
  if (h.state === 'built') return (p.append('built.'), p);
  const mats = h.mats.map((m) => `${m.have} of ${m.cost} ${m.good}`).join(' and ');
  p.append(`planned.${mats ? ` ${mats} here.` : ''}`);
  return p;
}

export class BuildSheet {
  /** Levers sent and not yet seen in a snapshot. */
  private level: number | undefined;
  private readonly back = new Set<number>();
  private readonly actions: BuildActions;
  constructor(actions: BuildActions) {
    this.actions = actions;
  }

  /** A key for what the sheet shows, so it is redrawn only when that changes. */
  key(view: BuildView): string {
    this.settle(view);
    return JSON.stringify([view, this.level, [...this.back]]);
  }

  rows(view: BuildView): HTMLElement[] {
    const level = this.level ?? view.want.level;
    const houses = el('div', { class: 'prio', 'data-testid': 'build-houses' });
    houses.append(
      el('span', { class: 'job' }, 'Houses'),
      stepper(level, WORDS[level - 1] ?? '', 'Houses', (next) => {
        this.level = next;
        this.actions.setBuild(next);
        this.actions.refresh();
      }),
    );
    const open = view.houses.filter((h) => h.state === 'plan');
    const rows: HTMLElement[] = [
      el(
        'p',
        { class: 'aside' },
        'What the colony needs built. Colonists choose where it goes and how big, and say why.',
      ),
      houses,
      el('p', { 'data-testid': 'build-need' }, `Need: ${view.need}.`),
    ];
    if (view.noGround)
      rows.push(
        el('p', { class: 'problem', role: 'alert' }, 'No ground near the green fits a house'),
      );
    if (!open.length && !view.noGround)
      rows.push(el('p', { class: 'muted' }, 'Nothing is planned.'));
    for (const h of open) rows.push(...this.plan(h));
    for (const h of view.houses.filter((h) => h.state === 'built')) {
      rows.push(planLine(h));
    }
    rows.push(
      el(
        'p',
        { class: 'aside' },
        'A plan can be sent back once; colonists then choose another site.',
      ),
    );
    return rows;
  }

  /** A plan's line, why the colony chose the site, and Send back (or that it was sent back). */
  private plan(h: BuildRow): HTMLElement[] {
    const out = [planLine(h), el('p', { class: 'aside' }, `Chosen: ${h.why}.`)];
    if (h.back) {
      const sending = this.back.has(h.id);
      const button = el(
        'button',
        { type: 'button', 'data-testid': 'send-back' },
        sending ? 'Sending back…' : 'Send back',
      );
      button.disabled = sending;
      button.addEventListener('click', () => {
        this.back.add(h.id);
        this.actions.sendBack(h.id);
        this.actions.refresh();
      });
      const row = el('div', { class: 'row' });
      row.append(button);
      out.push(row);
    } else if (h.sent) out.push(el('p', { class: 'muted' }, 'sent back once'));
    else out.push(el('p', { class: 'muted' }, 'Building has begun: it stays.'));
    return out;
  }

  /** Drops levers the snapshot now shows. */
  settle(view: BuildView): void {
    if (this.level === view.want.level) this.level = undefined;
    for (const id of this.back)
      if (!view.houses.some((h) => h.id === id && h.back)) this.back.delete(id);
  }
}
