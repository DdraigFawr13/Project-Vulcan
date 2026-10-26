// The P2.5 to P2.7 screens wired together: the portrait strip and alert line under the bar, the
// person sheet, the Work and Build sheets, the Alerts sheet and the dawn page (P2.9). Levers go out as commands for the next tick;
// Show on an alert moves the camera to the place, never a person (V-015).
import type {
  BuildView,
  FromWorker,
  LawView,
  AnimalPage,
  ItemView,
  LedgerLine,
  PersonView,
  ToWorker,
  WalkerView,
} from '../worker/index.ts';
import { content } from '../content/index.ts';
import { animalRows, goneRows } from './animalsheet.ts';
import { BuildSheet } from './build.ts';
import { itemRows } from './itemsheet.ts';
import { Dawn } from './dawn.ts';
import { el } from './dom.ts';
import type { Panel } from './panel.ts';
import { LawSheet } from './laws.ts';
import { PersonSheet } from './personsheet.ts';
import { Play } from './play.ts';
import { testModeOn } from './testmode.ts';
import { WorkSheet, type Day } from './work.ts';

export interface SheetDeps {
  bar: HTMLElement;
  panel: Panel;
  send(message: ToWorker): void;
  /** The tick of the last snapshot; levers are asked for the tick after it. */
  tick(): number;
  /** The ledger lines the page holds, oldest first. */
  lines(): readonly LedgerLine[];
  /** Moves the camera to a place (and its level) and marks it; `keep` leaves the sheet open. */
  show(x: number, y: number, z: number, keep?: boolean): void;
  /** A sheet opened from the strip, the alert line or another sheet: the bar shows no panel
   * button pressed, or only `kind`'s. */
  opened(kind?: string): void;
  /** Draws everyone on the map: as the world begins or loads, and when someone comes or goes. */
  drawPeople(people: readonly PersonView[]): void;
  /** The camera finds a person (and their level); the view only, never an order (V-015). */
  find(id: number): void;
  /** Rings the person whose sheet is open on the map, pulsing once if `pulse`; or no one. */
  follow(id: number | undefined, pulse: boolean): void;
  /** Rings and names everyone on the map, or stops. */
  names(on: boolean): void;
}

export class Sheets {
  private people: readonly PersonView[] = [];
  private walkers: readonly WalkerView[] = [];
  private day: Day = { workFrom: 6, workTo: 18, sleepFrom: 22, dawn: 6, dusk: 18 };
  private workKey = '';
  private buildView: BuildView | undefined;
  private buildKey = '';
  private lawView: LawView | undefined;
  private lawKey = '';
  /** The item page open: its id, what it shows (as JSON) and whether a fresh copy is asked for. */
  private itemOpen: { id: number; key: string; asked: boolean } | undefined;
  /** A world just began or loaded; its first batch of lines is not news. */
  private loaded = false;
  /** The person whose sheet is open. */
  private selected: number | undefined;
  private readonly play: Play;
  private readonly work: WorkSheet;
  private readonly build: BuildSheet;
  private readonly laws: LawSheet;
  private readonly person: PersonSheet;
  private readonly dawn: Dawn;

  private readonly deps: SheetDeps;

  constructor(deps: SheetDeps) {
    this.deps = deps;
    const command = (kind: string, data: Record<string, string | number>) =>
      deps.send({ type: 'command', tick: deps.tick() + 1, kind, data });
    this.work = new WorkSheet({
      setPriority: (person, job, level) => command('setPriority', { person, job, level }),
      openLaws: () => {
        this.open('laws');
        deps.opened('laws');
      },
      refresh: () => this.refresh(),
    });
    this.build = new BuildSheet({
      setBuild: (kind, level) => command('setBuild', { kind, level }),
      sendBack: (kind, id) => command('sendBack', { [kind]: id }),
      refresh: () => this.refreshBuild(),
    });
    this.laws = new LawSheet({
      setLaw: (law, setting) => command('setLaw', { law, setting }),
      refresh: () => this.refreshLaws(),
    });
    this.person = new PersonSheet(deps.panel, {
      work: (p, w) => this.work.personRows(p, w),
      lines: deps.lines,
      item: (id) => this.openItem(id),
      ...(testModeOn(new URLSearchParams(location.search)) && {
        hurt: (person: number, part: string, severity: string) =>
          command('hurt', { person, part, severity }),
        sicken: (person: number, ill: string) => command('sicken', { person, ill }),
      }),
    });
    this.dawn = new Dawn(deps.panel, deps.lines);
    this.play = new Play(deps.bar, {
      person: (p) => this.showPerson(p),
      find: (p) => deps.find(p.id),
      names: (on) => deps.names(on),
      alerts: () => this.showAlerts(),
    });
  }

  /** The band, as a world begins or loads. */
  setPeople(people: readonly PersonView[]): void {
    this.people = people;
    this.loaded = true;
    this.dawn.reset();
    this.deps.drawPeople(people);
    this.play.setPeople(people);
  }

  /** Someone came, stayed or left (P5.9): the strip follows, the alerts stay. */
  updatePeople(people: readonly PersonView[]): void {
    this.people = people;
    this.deps.drawPeople(people);
    this.play.setPeople(people, true);
  }

  showPerson(p: PersonView): void {
    this.person.show(p);
    this.select(p.id);
    this.deps.opened();
  }

  /** Asks for an item's page; `showItem` draws the answer. */
  openItem(id: number): void {
    this.deps.send({ type: 'item', id });
  }

  showItem(item: ItemView | undefined): void {
    const { panel } = this.deps;
    if (!item) {
      this.itemOpen = undefined;
      return panel.showView('item', 'Item', [el('p', { class: 'muted' }, 'It is gone.')]);
    }
    const key = JSON.stringify(item);
    const open = this.itemOpen;
    const refresh = open?.asked;
    if (open) open.asked = false;
    if (refresh && panel.kind !== 'item') return; // another sheet came up meanwhile
    // A refresh with nothing new leaves the page (and any chain opened on it) alone.
    if (open?.id === item.id && open.key === key && panel.kind === 'item') return;
    this.itemOpen = { id: item.id, key, asked: false };
    const rows = itemRows(item, {
      lineRow: (line, prefix) => panel.lineRow(line, prefix),
      look: (x, y, z) => this.deps.show(x, y, z, true),
    });
    panel.showView('item', item.name, rows);
    this.select(undefined);
    this.deps.opened();
  }

  /** The herd or pack page of a tapped animal (Bundle 2); view only. */
  showAnimal(page: AnimalPage | undefined): void {
    const { panel } = this.deps;
    const rows = page ? animalRows(page, (line) => panel.lineRow(line)) : goneRows();
    panel.showView('animal', page?.title ?? 'Animal', rows);
    this.select(undefined);
    this.deps.opened();
  }

  showWork(): void {
    this.workKey = '';
    this.refresh(true);
  }

  /** ⋯ → Work, Build, Laws or Yesterday (the dawn page at any time). */
  open(kind: 'work' | 'build' | 'laws' | 'dawn'): void {
    if (kind === 'work') return this.showWork();
    if (kind === 'build') {
      this.buildKey = '';
      return this.refreshBuild(true);
    }
    if (kind === 'laws') {
      this.lawKey = '';
      return this.refreshLaws(true);
    }
    this.dawn.show();
    this.select(undefined);
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
    this.select(undefined);
    this.deps.opened();
  }

  /** The strip and the map ring the person whose sheet is open; a newly opened one pulses. */
  private select(id: number | undefined): void {
    this.play.select(id);
    this.deps.follow(id, id !== this.selected);
    this.selected = id;
  }

  /** The panel closed. */
  closed(): void {
    this.select(undefined);
  }

  snapshot(message: Extract<FromWorker, { type: 'snapshot' }>): void {
    const { panel } = this.deps;
    const { walkers, day, law } = message;
    if (message.people) this.updatePeople(message.people);
    this.walkers = walkers;
    this.day = day;
    this.lawView = law;
    const food = message.stock.find((s) => s.good === content.work.forage.good)?.have;
    this.dawn.snapshot(message.yesterday, food, message.speed === 1 && !message.skipping);
    this.play.setWalkers(walkers);
    // Settled here, not only by the Work sheet: a person's Work tab shows the same pending levers.
    this.work.settle(walkers);
    this.work.setShaft(message.mining);
    this.person.setWalkers(walkers);
    this.refresh();
    if (message.build) this.buildView = message.build;
    this.refreshBuild();
    this.refreshLaws();
    // The item page redraws from each snapshot (its wear and holder move), one ask in flight.
    const item = this.itemOpen;
    if (item && panel.kind === 'item' && !item.asked) {
      item.asked = true;
      this.openItem(item.id);
    }
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
    const key = this.work.key(this.walkers, this.day, this.settingName());
    if (key === this.workKey) return;
    this.workKey = key;
    panel.showView(
      'work',
      'Work',
      this.work.rows(this.people, this.walkers, this.day, this.settingName()),
    );
    this.select(undefined);
  }

  /** The law's current setting in words, for the Work sheet's "Set by the work-hours law". */
  private settingName(): string {
    const v = this.lawView;
    return v?.settings.find((s) => s.id === v.setting)?.name ?? '';
  }

  /** Redraws an open Laws sheet when what it shows has changed (or `open`s it). */
  private refreshLaws(open = false): void {
    const view = this.lawView;
    if (!view || (!open && this.deps.panel.kind !== 'laws')) return;
    const key = this.laws.key(view);
    if (key === this.lawKey) return;
    this.lawKey = key;
    this.deps.panel.showView('laws', 'Laws', this.laws.rows(view));
    this.select(undefined);
  }

  /** Redraws an open Build sheet when what it shows has changed (or `open`s it). */
  private refreshBuild(open = false): void {
    const view = this.buildView;
    if (!view || (!open && this.deps.panel.kind !== 'build')) return;
    const key = this.build.key(view);
    if (key === this.buildKey) return;
    this.buildKey = key;
    this.deps.panel.showView('build', 'Build', this.build.rows(view));
    this.select(undefined);
  }
}
