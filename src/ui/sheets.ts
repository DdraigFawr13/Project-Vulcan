// The P2.5 to P2.7 screens wired together: the portrait strip and alert line under the bar, the
// person sheet, the Work sheet and the Alerts sheet. Levers go out as commands for the next tick;
// Show on an alert moves the camera to the place, never a person (V-015).
import type { LedgerLine, PersonView, ToWorker, WalkerView } from '../worker/index.ts';
import { el } from './dom.ts';
import type { Panel } from './panel.ts';
import { PersonSheet } from './personsheet.ts';
import { Play } from './play.ts';
import { WorkSheet, type Day } from './work.ts';

export interface SheetDeps {
  bar: HTMLElement;
  panel: Panel;
  send(message: ToWorker): void;
  /** The tick of the last snapshot; levers are asked for the tick after it. */
  tick(): number;
  /** The ledger lines the page holds, oldest first. */
  lines(): readonly LedgerLine[];
  /** Moves the camera to a place (and its level) and marks it. */
  show(x: number, y: number, z: number): void;
  /** A sheet opened from the strip or the alert line: the bar shows no panel button pressed. */
  opened(): void;
}

export class Sheets {
  private people: readonly PersonView[] = [];
  private walkers: readonly WalkerView[] = [];
  private day: Day = { workFrom: 6, workTo: 18, sleepFrom: 22 };
  private workKey = '';
  /** A world just began or loaded; its first batch of lines is not news. */
  private loaded = false;
  private readonly play: Play;
  private readonly work: WorkSheet;
  private readonly person: PersonSheet;

  private readonly deps: SheetDeps;

  constructor(deps: SheetDeps) {
    this.deps = deps;
    const command = (kind: string, data: Record<string, string | number>) =>
      deps.send({ type: 'command', tick: deps.tick() + 1, kind, data });
    this.work = new WorkSheet({
      setPriority: (person, job, level) => command('setPriority', { person, job, level }),
      setDay: (day) => command('setDay', { ...day }),
      refresh: () => this.refresh(),
    });
    this.person = new PersonSheet(deps.panel, {
      work: (p, w) => this.work.personRows(p, w),
      lines: deps.lines,
    });
    this.play = new Play(deps.bar, {
      person: (p) => this.showPerson(p),
      alerts: () => this.showAlerts(),
    });
  }

  /** The band, as a world begins or loads. */
  setPeople(people: readonly PersonView[]): void {
    this.people = people;
    this.loaded = true;
    this.play.setPeople(people);
  }

  showPerson(p: PersonView): void {
    this.person.show(p);
    this.play.select(p.id);
    this.deps.opened();
  }

  showWork(): void {
    this.workKey = '';
    this.refresh(true);
  }

  showAlerts(): void {
    const rows = this.play.read().map((line) => {
      const row = this.deps.panel.lineRow(line);
      const at = line.where;
      if (at) {
        const show = el(
          'button',
          { type: 'button', class: 'show', 'data-testid': 'alert-show' },
          'Show',
        );
        show.addEventListener('click', () => this.deps.show(at.x, at.y, at.z));
        const text = row.lastElementChild!;
        text.firstChild!.after(` · ${at.words}`);
        text.append(' ', show);
      }
      return row;
    });
    const none = el(
      'p',
      { class: 'muted' },
      'Nothing notable yet. Skip ahead stops on lines like these.',
    );
    this.deps.panel.showView('alerts', 'Alerts', rows.length ? rows : [none]);
    this.play.select(undefined);
    this.deps.opened();
  }

  /** The panel closed. */
  closed(): void {
    this.play.select(undefined);
  }

  snapshot(walkers: readonly WalkerView[], day: Day): void {
    this.walkers = walkers;
    this.day = day;
    this.play.setWalkers(walkers);
    // Settled here, not only by the Work sheet: a person's Work tab shows the same pending levers.
    this.work.settle(walkers, day);
    this.person.setWalkers(walkers);
    this.refresh();
  }

  lines(batch: readonly LedgerLine[]): void {
    // The first batch after a world begins or loads is its whole recent ledger: already seen.
    this.play.addLines(batch, !this.loaded);
    this.loaded = false;
    this.person.lines();
  }

  /** Redraws an open Work sheet when what it shows has changed (or `open`s it). */
  private refresh(open = false): void {
    const { panel } = this.deps;
    if (!open && panel.kind !== 'work') {
      // A person's Work tab answers its own steppers at once.
      if (panel.kind === 'person') this.person.setWalkers(this.walkers);
      return;
    }
    const key = this.work.key(this.walkers, this.day);
    if (key === this.workKey) return;
    this.workKey = key;
    panel.showView('work', 'Work', this.work.rows(this.people, this.walkers, this.day));
    this.play.select(undefined);
  }
}
