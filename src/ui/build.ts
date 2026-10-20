// The Build sheet (P3.7): what the colony needs built. The player sets how much it wants houses
// (the Work sheet's 1 to 4 stepper) and may send the current plan back once; the colony chooses
// where a house goes, how big and why (V-049), so nothing here picks a tile or a person. Levers
// apply at once while paused and show as sent until the snapshot carries them. Everything shown
// comes from the worker's `BuildView` (GAME-02).
import { content } from '../content/index.ts';
import type { BuildRow, BuildView } from '../worker/index.ts';
import { el } from './dom.ts';
import { stepper, WORDS } from './stepper.ts';

type BuildKind = 'house' | 'field' | 'smithy' | 'pasture';

export interface BuildActions {
  setBuild(kind: BuildKind, level: number): void;
  sendBack(kind: BuildKind | 'burial', id: number): void;
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

/** "Barley field, 36 tiles, east of the green: planned." */
function fieldLine(f: BuildView['fields'][number]): HTMLElement {
  const p = el('p', { 'data-testid': 'build-field' });
  p.append(el('b', {}, f.name), `, ${f.tiles} tiles, ${f.dir} of the green: ${f.words}.`);
  return p;
}

export class BuildSheet {
  /** Levers sent and not yet seen in a snapshot. */
  private level: number | undefined;
  private fieldLevel: number | undefined;
  private smithyLevel: number | undefined;
  private pastureLevel: number | undefined;
  private backPasture = false;
  private backSmithy = false;
  private backBurial = false;
  private readonly back = new Set<number>();
  private readonly backFields = new Set<number>();
  private readonly actions: BuildActions;
  constructor(actions: BuildActions) {
    this.actions = actions;
  }

  /** A key for what the sheet shows, so it is redrawn only when that changes. */
  key(view: BuildView): string {
    this.settle(view);
    return JSON.stringify([
      view,
      this.level,
      this.fieldLevel,
      this.smithyLevel,
      this.pastureLevel,
      this.backSmithy,
      this.backBurial,
      this.backPasture,
      [...this.back],
      [...this.backFields],
    ]);
  }

  /** A kind's priority row: the Work sheet's own stepper, sent as `setBuild`. */
  private levelRow(kind: BuildKind, name: string, shown: number): HTMLElement {
    const row = el('div', { class: 'prio', 'data-testid': `build-${kind}s` });
    row.append(
      el('span', { class: 'job' }, name),
      stepper(shown, WORDS[shown - 1] ?? '', name, (next) => {
        if (kind === 'house') this.level = next;
        else if (kind === 'smithy') this.smithyLevel = next;
        else if (kind === 'pasture') this.pastureLevel = next;
        else this.fieldLevel = next;
        this.actions.setBuild(kind, next);
        this.actions.refresh();
      }),
    );
    return row;
  }

  /** The Fields row, the need in tiles of crops and each field with its reason. */
  private fieldRows(view: BuildView): HTMLElement[] {
    const rows: HTMLElement[] = [
      this.levelRow('field', 'Fields', this.fieldLevel ?? view.fieldWant.level),
      el('p', { 'data-testid': 'build-field-need' }, `Need: ${view.fieldNeed}.`),
    ];
    if (view.noField)
      rows.push(
        el(
          'p',
          { class: 'problem', role: 'alert' },
          'No good soil outside the town ring fits a field',
        ),
      );
    for (const f of view.fields) {
      rows.push(fieldLine(f));
      if (f.state !== 'plan') continue;
      rows.push(el('p', { class: 'aside' }, `Why here: ${f.why}.`));
      if (f.back) {
        const sending = this.backFields.has(f.id);
        const button = el(
          'button',
          { type: 'button', 'data-testid': 'send-back-field' },
          sending ? 'Sending back…' : 'Send back',
        );
        button.disabled = sending;
        button.addEventListener('click', () => {
          this.backFields.add(f.id);
          this.actions.sendBack('field', f.id);
          this.actions.refresh();
        });
        const row = el('div', { class: 'row' });
        row.append(button);
        rows.push(row);
      } else if (f.sent) rows.push(el('p', { class: 'muted' }, 'sent back once'));
    }
    if (!view.fields.length && !view.noField)
      rows.push(el('p', { class: 'muted' }, 'No field is planned.'));
    return rows;
  }

  rows(view: BuildView): HTMLElement[] {
    const houses = this.levelRow('house', 'Houses', this.level ?? view.want.level);
    const open = view.houses.filter((h) => h.state === 'plan');
    const rows: HTMLElement[] = [
      el(
        'p',
        { class: 'aside' },
        'What the colony needs built. Colonists choose where it goes and how big, and say why.',
      ),
      ...this.fieldRows(view),
      ...(view.pasture ? this.pastureRows(view.pasture) : []),
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
    if (view.smithy) rows.push(...this.smithyRows(view.smithy));
    if (view.burial) rows.push(...this.burialRows(view.burial));
    rows.push(
      el(
        'p',
        { class: 'aside' },
        'A plan can be sent back once; colonists then choose another site.',
      ),
    );
    return rows;
  }

  /** The Pasture row (it appears while wild sheep or goats live in the valley, or a pasture is
   * planned): its level, the need, and the plan with why the colony sited it there and Send back
   * while nothing is built. No tile, no animal (V-041). */
  private pastureRows(view: NonNullable<BuildView['pasture']>): HTMLElement[] {
    const name = content.flock.pasture.name;
    const rows = [
      this.levelRow('pasture', name, this.pastureLevel ?? view.want.level),
      el('p', { 'data-testid': 'build-pasture-need' }, `Need: ${view.need}.`),
    ];
    const plan = view.plan;
    if (!plan) return rows;
    const line = el('p', { 'data-testid': 'build-pasture' });
    line.append(el('b', {}, name), `, ${plan.words}`);
    rows.push(line, el('p', { class: 'aside' }, `Why here: ${plan.why}.`));
    if (plan.back) {
      const button = el(
        'button',
        { type: 'button', 'data-testid': 'send-back-pasture' },
        this.backPasture ? 'Sending back…' : 'Send back',
      );
      button.disabled = this.backPasture;
      button.addEventListener('click', () => {
        this.backPasture = true;
        this.actions.sendBack('pasture', plan.id);
        this.actions.refresh();
      });
      rows.push(el('div', { class: 'row' }, button));
    } else if (plan.sent) rows.push(el('p', { class: 'muted' }, 'sent back once'));
    return rows;
  }

  /** The Smithy row (it appears with the first ingot in the store): its level, and the plan with
   * why the colony put it there and Send back while nothing is built. No tile, no person. */
  private smithyRows(view: NonNullable<BuildView['smithy']>): HTMLElement[] {
    const rows = [this.levelRow('smithy', 'Smithy', this.smithyLevel ?? view.want.level)];
    const plan = view.plan;
    if (!plan) return [...rows, el('p', { class: 'muted' }, 'No smithy is planned.')];
    const line = el('p', { 'data-testid': 'build-smithy' });
    line.append(
      el('b', {}, 'Smithy'),
      `, ${plan.state === 'built' ? 'built' : 'planned'} ${plan.where}. Why here: ${plan.why}.`,
    );
    rows.push(line);
    if (plan.back) {
      const button = el(
        'button',
        { type: 'button', 'data-testid': 'send-back-smithy' },
        this.backSmithy ? 'Sending back…' : 'Send back',
      );
      button.disabled = this.backSmithy;
      button.addEventListener('click', () => {
        this.backSmithy = true;
        this.actions.sendBack('smithy', plan.id);
        this.actions.refresh();
      });
      const row = el('div', { class: 'row' });
      row.append(button);
      rows.push(row);
    } else if (plan.sent) rows.push(el('p', { class: 'muted' }, 'sent back once'));
    else if (plan.state === 'plan')
      rows.push(el('p', { class: 'muted' }, 'Building has begun: it stays.'));
    return rows;
  }

  /** The burial ground (V-041): the colony sites it and digs the graves; the one lever is Send
   * back, once, until the first grave is dug. No tile, no person. */
  private burialRows(view: NonNullable<BuildView['burial']>): HTMLElement[] {
    const line = el('p', { 'data-testid': 'build-burial' });
    line.append(
      el('b', {}, 'Burial ground'),
      `, ${view.w} by ${view.h} tiles, ${view.dir} of the green. Why here: ${view.why}.`,
    );
    const rows = [line];
    if (view.back) {
      const button = el(
        'button',
        { type: 'button', 'data-testid': 'send-back-burial' },
        this.backBurial ? 'Sending back…' : 'Send back',
      );
      button.disabled = this.backBurial;
      button.addEventListener('click', () => {
        this.backBurial = true;
        this.actions.sendBack('burial', view.id);
        this.actions.refresh();
      });
      const row = el('div', { class: 'row' });
      row.append(button);
      rows.push(row);
    } else if (view.sent) rows.push(el('p', { class: 'muted' }, 'sent back once'));
    else rows.push(el('p', { class: 'muted' }, 'A grave is dug: it stays.'));
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
        this.actions.sendBack('house', h.id);
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
    if (this.fieldLevel === view.fieldWant.level) this.fieldLevel = undefined;
    if (this.smithyLevel === view.smithy?.want.level) this.smithyLevel = undefined;
    if (!view.smithy?.plan?.back) this.backSmithy = false;
    if (!view.burial?.back) this.backBurial = false;
    if (this.pastureLevel === view.pasture?.want.level) this.pastureLevel = undefined;
    if (!view.pasture?.plan?.back) this.backPasture = false;
    for (const id of this.backFields)
      if (!view.fields.some((f) => f.id === id && f.back)) this.backFields.delete(id);
    for (const id of this.back)
      if (!view.houses.some((h) => h.id === id && h.back)) this.back.delete(id);
  }
}
