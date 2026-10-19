// The Work sheet (P2.5): what matters more to each person, and the colony's day. On a phone one
// person at a time with a 1 to 4 stepper per kind of work; on a desktop the whole band as a grid.
// Priorities are weighed, not obeyed (V-015): a person may decline, and the sheet shows the line
// that says why. A change is a lever for the next tick, applied at once while paused, and shown
// as sent until the snapshot carries it. Everything shown comes from the snapshot (GAME-02).
import { content } from '../content/index.ts';
import type { PersonView, WalkerView } from '../worker/index.ts';
import { el } from './dom.ts';
import { LEVELS, stepper, WORDS } from './stepper.ts';
import { commonLevel, grouped, visibleJobs, type Group } from './workheads.ts';

export interface Day {
  workFrom: number;
  workTo: number;
  sleepFrom: number;
}

export interface WorkActions {
  setPriority(person: number, job: string, level: number): void;
  setDay(day: Day): void;
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

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
const wide = () => matchMedia('(min-width: 641px)').matches;
const first = (p: PersonView) => p.name.split(' ')[0]!;

export class WorkSheet {
  /** The person shown on a phone, by index into the band. */
  private index = 0;
  /** Levers sent and not yet seen in a snapshot, shown as sent meanwhile. */
  private readonly pending = new Map<string, number>();
  private pendingDay: Day | undefined;
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

  /** Whether a shaft exists (a level below is reached): the mining row shows from then on. */
  setShaft(exists: boolean): void {
    this.shaft = exists;
  }

  /** A key for what the sheet shows, so it is redrawn only when that changes. */
  key(walkers: readonly WalkerView[], day: Day): string {
    this.settle(walkers, day);
    const work = walkers.map((w) => [w.work, w.skills.map((s) => s.level)]);
    const open = [...this.unfolded];
    return JSON.stringify([
      this.index,
      work,
      day,
      [...this.pending],
      this.pendingDay,
      wide(),
      open,
      this.shaft,
    ]);
  }

  /** The whole sheet: the band's priorities and the colony's day. */
  rows(people: readonly PersonView[], walkers: readonly WalkerView[], day: Day): HTMLElement[] {
    return [
      ...(wide() ? this.grid(people, walkers) : this.one(people, walkers)),
      ...(walkers[0]?.work.some((j) => j.job === content.buildings.furniture.job)
        ? [el('p', { class: 'aside' }, makesNote())]
        : []),
      el('p', { class: 'aside' }, 'Other kinds of work join this list when the band can do them.'),
      ...this.dayRows(day),
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
        ...(this.unfolded.has(g.name)
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

  /** The desktop grid: a person per row, a kind of work per column; a cell cycles 1 to 4. */
  private grid(people: readonly PersonView[], walkers: readonly WalkerView[]) {
    const jobs = visibleJobs(walkers[0]?.work ?? [], this.shaft);
    const table = el('table', { class: 'grid' });
    const head = el('tr', {}, el('th', {}, ''));
    for (const j of jobs) head.append(el('th', {}, j.name));
    table.append(head);
    const notes: HTMLElement[] = [];
    for (const p of people) {
      const w = walkers.find((x) => x.id === p.id);
      const tr = el('tr', {}, el('th', {}, first(p)));
      for (const job of visibleJobs(w?.work ?? [], this.shaft)) {
        const level = this.pending.get(`${p.id}:${job.job}`) ?? job.level;
        const label = `${job.name} for ${p.name}: ${WORDS[level - 1]}`;
        const cell = el(
          'button',
          { type: 'button', class: 'cell', 'aria-label': label },
          String(level),
        );
        cell.addEventListener('click', () => this.priority(p, job, (level % LEVELS) + 1));
        tr.append(el('td', {}, cell));
        if (job.declined) {
          const row = el('div', { class: 'prio' });
          this.declined(row, p, job);
          notes.push(row);
        }
      }
      table.append(tr);
    }
    return [table, ...notes];
  }

  private dayRows(day: Day): HTMLElement[] {
    const d = this.pendingDay ?? day;
    const label = `Work ${hh(d.workFrom)} to ${hh(d.workTo)}, bed at ${hh(d.sleepFrom)}`;
    const strip = el('div', { class: 'day', role: 'img', 'aria-label': label });
    for (let h = 0; h < 24; h += 1)
      strip.append(
        el('i', { class: h < d.workFrom || h >= d.sleepFrom ? 's' : h < d.workTo ? 'w' : 'f' }),
      );
    const hours = el('div', { class: 'dayk' });
    for (const h of [0, 6, 12, 18, 24]) hours.append(el('span', {}, String(h).padStart(2, '0')));
    const legend = el('p', { class: 'legend' });
    for (const [k, word] of [
      ['s', 'sleep'],
      ['w', 'work'],
      ['f', 'free time'],
    ] as const)
      legend.append(el('b', { class: k }), word);
    // Steppers stop at the edges the worker also checks: work begins after 01:00, ends after it
    // begins, and bed is no earlier than the end of work.
    const ok = (n: Day) =>
      n.workFrom >= 1 && n.workFrom < n.workTo && n.workTo <= n.sleepFrom && n.sleepFrom <= 24;
    const row = (name: string, part: keyof Day) => {
      const r = el('div', { class: 'prio', 'data-day': part }, el('span', { class: 'job' }, name));
      r.append(
        stepper(
          d[part],
          '',
          name,
          (v) => {
            const next = { ...d, [part]: v };
            if (!ok(next)) return;
            this.pendingDay = next;
            this.actions.setDay(next);
            this.actions.refresh();
          },
          hh,
          0,
          24,
          (v) => ok({ ...d, [part]: v }),
        ),
      );
      return r;
    };
    return [
      el('h3', {}, "The colony's day"),
      el(
        'p',
        { class: 'aside' },
        'One timetable for everyone. Each person keeps to it as well as their needs allow.',
      ),
      strip,
      hours,
      legend,
      row('Work starts', 'workFrom'),
      row('Work ends', 'workTo'),
      row('Bed at', 'sleepFrom'),
    ];
  }

  /** Drops pending levers the snapshot now shows. */
  settle(walkers: readonly WalkerView[], day: Day): void {
    for (const [key, level] of this.pending) {
      const [id, job] = key.split(':');
      const now = walkers.find((w) => w.id === Number(id))?.work.find((j) => j.job === job);
      if (!now || now.level === level) this.pending.delete(key);
    }
    const d = this.pendingDay;
    if (
      d &&
      d.workFrom === day.workFrom &&
      d.workTo === day.workTo &&
      d.sleepFrom === day.sleepFrom
    )
      this.pendingDay = undefined;
  }
}
