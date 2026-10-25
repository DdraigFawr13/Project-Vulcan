// The Work sheet (P2.5): what matters more to each person, and the colony's day. On a phone one
// person at a time with a 1 to 4 stepper per kind of work; on a desktop the whole band as a grid.
// Priorities are weighed, not obeyed (V-015): a person may decline, and the sheet shows the line
// that says why. A change is a lever for the next tick, applied at once while paused, and shown
// as sent until the snapshot carries it. Everything shown comes from the snapshot (GAME-02).
import { content } from '../content/index.ts';
import type { HoursView, PersonView, WalkerView } from '../worker/index.ts';
import { el } from './dom.ts';
import { dayStrip } from './daystrip.ts';
import { LEVELS, stepper, WORDS } from './stepper.ts';
import { commonLevel, grouped, visibleJobs, type Group } from './workheads.ts';

export type Day = HoursView;

export interface WorkActions {
  setPriority(person: number, job: string, level: number): void;
  /** The colony's day shows the law; this opens the Laws sheet. */
  openLaws(): void;
  /** The sheet changed on its own (another person shown, a lever sent): draw it again. */
  refresh(): void;
}

type Job = WalkerView['work'][number];

/** What colonists make first, from the first role's wants in content: "beds first, then a table,
 * chairs, a chest, a shelf". */
function makesNote(): string {
  const kinds = content.buildings.rooms.wants[0]?.kinds ?? [];
  const word = (k: (typeof kinds)[number]) => (k.per === 'sleeper' ? `${k.kind}s` : `a ${k.kind}`);
  const [head, ...rest] = kinds;
  return head
    ? `Colonists make what a room lacks: ${word(head)} first, then ${rest.map(word).join(', ')}.`
    : '';
}

const wide = () => matchMedia('(min-width: 641px)').matches;
const first = (p: PersonView) => p.name.split(' ')[0]!;

export class WorkSheet {
  /** The person shown on a phone, by index into the band. */
  private index = 0;
  /** Levers sent and not yet seen in a snapshot, shown as sent meanwhile. */
  private readonly pending = new Map<string, number>();
  /** Headings folded open (V-071): the first begins open, the rest folded. */
  private readonly unfolded = new Set<string>(
    content.work.priority.headings.slice(0, 1).map((h) => h.name),
  );
  /** A shaft exists or is planned, so the mining row shows. */
  private shaft = false;
  private readonly actions: WorkActions;
  constructor(actions: WorkActions) {
    this.actions = actions;
  }

  /** Opens on this person (a face tapped while the sheet is up). */
  show(id: number, people: readonly PersonView[]): void {
    this.index = Math.max(
      0,
      people.findIndex((p) => p.id === id),
    );
  }

  /** Whether a shaft is planned or dug (the worker says): the mining row shows from then on. */
  setShaft(exists: boolean): void {
    this.shaft = exists;
  }

  /** A key for what the sheet shows, so it is redrawn only when that changes. */
  key(walkers: readonly WalkerView[], day: Day, setting: string): string {
    this.settle(walkers);
    const work = walkers.map((w) => [w.work, w.skills.map((s) => s.level)]);
    const open = [...this.unfolded];
    return JSON.stringify([
      this.index,
      work,
      day,
      setting,
      [...this.pending],
      wide(),
      open,
      this.shaft,
    ]);
  }

  /** The whole sheet: the band's priorities and the colony's day. */
  rows(
    people: readonly PersonView[],
    walkers: readonly WalkerView[],
    day: Day,
    setting: string,
  ): HTMLElement[] {
    return [
      ...(wide() ? this.grid(people, walkers) : this.one(people, walkers)),
      ...(walkers[0]?.work.some((j) => j.job === content.buildings.furniture.job)
        ? [el('p', { class: 'aside' }, makesNote())]
        : []),
      ...(walkers[0]?.work.some((j) => j.job === content.flock.job)
        ? [el('p', { class: 'aside', 'data-testid': 'watch-note' }, content.flock.watchNote)]
        : []),
      el('p', { class: 'aside' }, 'Other kinds of work join this list when the band can do them.'),
      el(
        'p',
        { class: 'aside', 'data-testid': 'care-note' },
        content.health.words['workNote'] ?? '',
      ),
      ...this.dayRows(day, setting, () => this.actions.openLaws()),
    ];
  }

  /** One person's priorities, for the Work tab of their sheet. */
  personRows(p: PersonView, w: WalkerView | undefined): HTMLElement[] {
    return [
      el(
        'p',
        { class: 'aside' },
        `What matters most to ${first(p)} when there is work to do. ${first(p)} still chooses, and may decline.`,
      ),
      ...this.tradeRows(p, w),
    ];
  }

  /** The rows on top, then each trade heading with its rows when it is unfolded. */
  private tradeRows(p: PersonView, w: WalkerView | undefined): HTMLElement[] {
    if (!w) return [];
    const { plain, groups } = grouped(visibleJobs(w.work, this.shaft));
    return [
      ...plain.map((job) => this.jobRow(p, w, job)),
      ...groups.flatMap((g) => [
        this.headingRow(p, g),
        ...(this.unfolded.has(g.name) || g.jobs.length === 1
          ? g.jobs.map((job) => {
              const row = this.jobRow(p, w, job);
              row.classList.add('under');
              return row;
            })
          : []),
      ]),
    ];
  }

  /** A heading: a fold button (▾ open, ▸ folded), its rows' names beneath, and a stepper that
   * sets every row under it with the per-person priority command, one for each job. */
  private headingRow(p: PersonView, g: Group): HTMLElement {
    // A heading over one row (Care) is just a label: the row is always shown and has the stepper.
    if (g.jobs.length === 1) {
      const label = el('div', { class: 'prio head single', 'data-heading': g.name });
      const name = el('span', { class: 'job' }, `▾ ${g.name}`);
      name.append(el('small', {}, g.jobs[0]!.name));
      label.append(name);
      return label;
    }
    const open = this.unfolded.has(g.name);
    const fold = el(
      'button',
      { type: 'button', class: 'fold', 'aria-expanded': String(open), 'data-heading': g.name },
      `${open ? '▾' : '▸'} ${g.name}`,
    );
    fold.addEventListener('click', () => {
      if (!this.unfolded.delete(g.name)) this.unfolded.add(g.name);
      this.actions.refresh();
    });
    const name = el('span', { class: 'job' }, fold);
    name.append(el('small', {}, g.jobs.map((j) => j.name).join(', ')));
    const value = commonLevel(g.jobs.map((j) => this.pending.get(`${p.id}:${j.job}`) ?? j.level));
    const row = el('div', { class: 'prio head', 'data-heading': g.name });
    row.append(
      name,
      stepper(value, WORDS[value - 1] ?? '', `${g.name}, every row, for ${p.name}`, (level) => {
        for (const job of g.jobs) this.send(p, job, level);
        this.actions.refresh();
      }),
    );
    return row;
  }

  private one(people: readonly PersonView[], walkers: readonly WalkerView[]) {
    const p = people[Math.min(this.index, people.length - 1)];
    if (!p) return [el('p', {}, 'No one has arrived yet.')];
    const step = (by: 1 | -1) => {
      const b = el(
        'button',
        {
          type: 'button',
          'aria-label': by < 0 ? 'Previous person' : 'Next person',
          'data-testid': by < 0 ? 'work-prev' : 'work-next',
        },
        by < 0 ? '◀' : '▶',
      );
      b.addEventListener('click', () => {
        this.index = (this.index + by + people.length) % people.length;
        this.actions.refresh();
      });
      return b;
    };
    const who = el('div', { class: 'who' }, p.home ? `${p.name} of ${p.home}` : p.name);
    who.append(
      el('small', {}, `${this.index + 1} of ${people.length} · trade: ${p.trade.toLowerCase()}`),
    );
    const pager = el('div', { class: 'pager' });
    pager.append(step(-1), who, step(1));
    return [
      pager,
      ...this.personRows(
        p,
        walkers.find((x) => x.id === p.id),
      ),
    ];
  }

  private jobRow(p: PersonView, w: WalkerView, job: Job): HTMLElement {
    const key = `${p.id}:${job.job}`;
    const want = this.pending.get(key) ?? job.level;
    const skill = w.skills.find((s) => s.id === job.skill);
    const row = el('div', { class: 'prio', 'data-job': job.job });
    const name = el('span', { class: 'job' }, job.name);
    const about = skill
      ? `${skill.name.toLowerCase()} ${skill.level}, can reach ${skill.potential}`
      : 'no skill needed';
    name.append(el('small', {}, about));
    row.append(
      name,
      stepper(want, WORDS[want - 1] ?? '', `${job.name} for ${p.name}`, (level) =>
        this.priority(p, job, level),
      ),
    );
    if (job.declined && !this.pending.has(key)) this.declined(row, p, job);
    return row;
  }

  /** "Name declined this. why?"; the row carries the line so its chain opens beneath it. */
  private declined(row: HTMLElement, p: PersonView, job: Job): void {
    row.dataset['line'] = String(job.declined);
    const note = el('span', { class: 'note' }, `${first(p)} declined ${job.name.toLowerCase()}. `);
    note.append(
      el('button', { type: 'button', class: 'why', 'data-why': String(job.declined) }, 'why?'),
    );
    row.append(note);
  }

  private priority(p: PersonView, job: Job, level: number): void {
    this.send(p, job, level);
    this.actions.refresh();
  }

  /** One `setPriority` lever, shown as sent until the snapshot carries it. */
  private send(p: PersonView, job: Job, level: number): void {
    this.pending.set(`${p.id}:${job.job}`, level);
    this.actions.setPriority(p.id, job.job, level);
  }

  /** The desktop grid: a person per column, a kind of work per row, grouped under the trade
   * headings like the phone sheet (a heading's cell sets every row under it); a cell cycles 1 to 4. */
  private grid(people: readonly PersonView[], walkers: readonly WalkerView[]) {
    const table = el('table', { class: 'grid' });
    const head = el('tr', {}, el('th', {}, ''));
    for (const p of people) head.append(el('th', { class: 'who', title: p.name }, first(p)));
    table.append(head);
    const notes: HTMLElement[] = [];
    const jobOf = (p: PersonView, id: string): Job | undefined =>
      visibleJobs(walkers.find((x) => x.id === p.id)?.work ?? [], this.shaft).find(
        (j) => j.job === id,
      );
    const level = (p: PersonView, job: Job) => this.pending.get(`${p.id}:${job.job}`) ?? job.level;
    const cell = (p: PersonView, label: string, now: number, set: (to: number) => void) => {
      const b = el(
        'button',
        {
          type: 'button',
          class: 'cell',
          'aria-label': `${label} for ${p.name}: ${WORDS[now - 1]}`,
        },
        String(now),
      );
      b.addEventListener('click', () => set((now % LEVELS) + 1));
      return el('td', {}, b);
    };
    const line = (name: HTMLElement, cells: HTMLElement[], under = false) => {
      const tr = el('tr', under ? { class: 'under' } : {}, el('th', {}, name));
      tr.append(...cells);
      table.append(tr);
    };
    const rowFor = (job: Job, under: boolean) => {
      line(
        el('span', {}, job.name),
        people.map((p) => {
          const j = jobOf(p, job.job);
          return j ? cell(p, j.name, level(p, j), (to) => this.priority(p, j, to)) : el('td');
        }),
        under,
      );
      for (const p of people) {
        const j = jobOf(p, job.job);
        if (j?.declined && !this.pending.has(`${p.id}:${j.job}`)) {
          const row = el('div', { class: 'prio' });
          this.declined(row, p, j);
          notes.push(row);
        }
      }
    };
    const { plain, groups } = grouped(visibleJobs(walkers[0]?.work ?? [], this.shaft));
    for (const job of plain) rowFor(job, false);
    for (const g of groups) {
      if (g.jobs.length === 1) {
        // A heading over one row is a label; the row is always shown and carries the steppers.
        line(
          el('span', {}, `▾ ${g.name}`),
          people.map(() => el('td')),
        );
        rowFor(g.jobs[0]!, true);
        continue;
      }
      const open = this.unfolded.has(g.name);
      const fold = el(
        'button',
        { type: 'button', class: 'fold', 'aria-expanded': String(open), 'data-heading': g.name },
        `${open ? '▾' : '▸'} ${g.name}`,
      );
      fold.addEventListener('click', () => {
        if (!this.unfolded.delete(g.name)) this.unfolded.add(g.name);
        this.actions.refresh();
      });
      line(
        fold,
        people.map((p) => {
          const jobs = g.jobs.flatMap((j) => jobOf(p, j.job) ?? []);
          if (!jobs.length) return el('td');
          const common = commonLevel(jobs.map((j) => level(p, j)));
          return cell(p, `${g.name}, every row`, common, (to) => {
            for (const j of jobs) this.send(p, j, to);
            this.actions.refresh();
          });
        }),
      );
      if (open) for (const job of g.jobs) rowFor(job, true);
    }
    return [table, ...notes];
  }

  private dayRows(day: Day, setting: string, openLaws: () => void): HTMLElement[] {
    const open = el('button', { type: 'button', 'data-testid': 'work-open-laws' }, 'Open Laws');
    open.addEventListener('click', openLaws);
    return [
      el('h3', {}, "The colony's day"),
      el('p', { class: 'aside' }, `Set by the work-hours law: ${setting}.`),
      ...dayStrip(day),
      el('div', { class: 'row' }, open),
    ];
  }

  /** Drops pending levers the snapshot now shows. */
  settle(walkers: readonly WalkerView[]): void {
    for (const [key, level] of this.pending) {
      const [id, job] = key.split(':');
      const now = walkers.find((w) => w.id === Number(id))?.work.find((j) => j.job === job);
      if (!now || now.level === level) this.pending.delete(key);
    }
  }
}
