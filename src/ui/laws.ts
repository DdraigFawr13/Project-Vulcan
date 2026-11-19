// The Laws sheet (P4.8, P6.5): what the colony expects, as a setting the player picks, and how
// each person weighs it. A law is a lever, never an order: people obey, grumble or refuse (V-091).
// Every law folds to one line (its setting and how the band answers) and one opens at a time, so
// five laws fit a phone's sheet. The setting applies at once while paused and shows as sent until
// the snapshot carries it. Everything shown comes from the worker's `LawView` (GAME-02).
import type { AnswerView, LawView, RuledLawView, StrangersLawView } from '../worker/index.ts';
import { dayStrip } from './daystrip.ts';
import { el } from './dom.ts';

export interface LawActions {
  setLaw(law: string, setting: string): void;
  /** The sheet changed on its own (a lever sent): draw it again. */
  refresh(): void;
}

const why = (line: number): HTMLElement =>
  el('button', { type: 'button', class: 'why', 'data-why': String(line) }, 'why?');

const GROUPS = [
  ['refuses', 'Refuses'],
  ['grumbles', 'Grumbles'],
  ['obeys', 'Obeys'],
] as const;

/** A law's settings as a group of 44 px buttons, the one in force pressed. */
function settingRow(
  law: { id: string; name: string; settings: { id: string; name: string }[] },
  on: string,
  pick: (id: string) => void,
): HTMLElement {
  const row = el('div', { class: 'row', role: 'group', 'aria-label': `${law.name} law` });
  for (const s of law.settings) {
    const b = el(
      'button',
      {
        type: 'button',
        'aria-pressed': String(s.id === on),
        ...(s.id === on && { class: 'solid' }),
        'data-setting': s.id,
      },
      s.name,
    );
    b.addEventListener('click', () => s.id !== on && pick(s.id));
    row.append(b);
  }
  return row;
}

/** Answers grouped, refusals first, under a count line. */
const answerRows = (answers: readonly AnswerView[]): HTMLElement[] => [
  el('p', { class: 'aside' }, `${tally(answers)}. Refusals first.`),
  ...GROUPS.flatMap(([id, name]) => {
    const mine = answers.filter((a) => a.answer === id);
    return mine.length ? [el('p', { class: 'group' }, name), ...mine.map(answerBlock)] : [];
  }),
];

/** "1 refuses, 2 grumble, 2 obey" */
function tally(answers: readonly AnswerView[]): string {
  const n = (a: AnswerView['answer']) => answers.filter((x) => x.answer === a).length;
  const verb = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;
  const parts = [
    n('refuses') && verb(n('refuses'), 'refuses', 'refuse'),
    n('grumbles') && verb(n('grumbles'), 'grumbles', 'grumble'),
    n('obeys') && verb(n('obeys'), 'obeys', 'obey'),
  ].filter(Boolean);
  return parts.join(', ');
}

/** One person's answer: name, their words and why?, what weighed, and the lines behind it. */
function answerBlock(a: AnswerView): HTMLElement {
  const block = el('div', {
    class: 'ans',
    'data-line': String(a.why),
    'data-person': String(a.person),
  });
  const say = el('p');
  say.append(`${a.text} `, why(a.why));
  const weighed = el('p', { class: 'w' });
  const text = [
    a.for.length ? `For: ${a.for.join(', ')}.` : '',
    a.against.length ? `Against: ${a.against.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  weighed.append(text);
  for (const l of a.links)
    weighed.append(
      ' ',
      el('button', { type: 'button', class: 'why', 'data-why': String(l.why) }, l.text),
    );
  block.append(el('span', { class: 'who' }, a.name), say, weighed);
  return block;
}

/** A law as the sheet folds it: what every law shows the same way. */
interface Folded {
  id: string;
  name: string;
  setting: string;
  settings: { id: string; name: string }[];
  about: string;
  since: string;
  why: number;
  answers: AnswerView[];
}

export class LawSheet {
  /** The settings sent and not yet seen in a snapshot, by law. */
  private pending = new Map<string, string>();
  /** The one law open, if any (P6.5: every law folds to one line). */
  private open: string | undefined;
  private readonly actions: LawActions;
  constructor(actions: LawActions) {
    this.actions = actions;
  }

  private all(view: LawView): Folded[] {
    return [view, view.strangers, ...view.ruled];
  }

  /** A key for what the sheet shows, so it is redrawn only when that changes. */
  key(view: LawView): string {
    for (const [law, on] of this.pending)
      if (this.all(view).find((l) => l.id === law)?.setting === on) this.pending.delete(law);
    return JSON.stringify([view, [...this.pending], this.open]);
  }

  private pick(law: string, setting: string): void {
    this.pending.set(law, setting);
    this.actions.setLaw(law, setting);
    this.actions.refresh();
  }

  rows(view: LawView): HTMLElement[] {
    return [
      el(
        'p',
        { class: 'aside' },
        'A law says what the colony expects. Each person weighs it for themselves: they obey, grumble, or refuse. Nobody is made to.',
      ),
      ...this.law(
        view,
        () => this.hours(view),
        () => dayStrip(view.hours),
      ),
      ...this.law(view.strangers, () => this.strangers(view.strangers)),
      ...view.ruled.flatMap((l) => this.law(l, () => this.ruled(l))),
    ];
  }

  /** One law: its fold line, and when open, its settings, `top` (the day strip), what the setting
   * does, since when, and `body` (the answers). */
  private law(
    l: Folded,
    body: () => HTMLElement[],
    top: () => HTMLElement[] = () => [],
  ): HTMLElement[] {
    const isOpen = this.open === l.id;
    const on = this.pending.get(l.id) ?? l.setting;
    const name = l.settings.find((s) => s.id === on)?.name ?? on;
    const fold = el(
      'button',
      {
        type: 'button',
        class: 'fold',
        'aria-expanded': String(isOpen),
        'aria-label': `${isOpen ? 'Hide' : 'Show'} the ${l.name.toLowerCase()} law`,
      },
      isOpen ? '▾' : '▸',
    );
    fold.addEventListener('click', () => {
      this.open = isOpen ? undefined : l.id;
      this.actions.refresh();
      // The law just opened comes to the top of the sheet, so its settings are in view.
      if (!isOpen) document.querySelector(`.lawfold[data-law="${l.id}"]`)?.scrollIntoView();
    });
    const head = el('div', { class: 'lawfold', 'data-law': l.id });
    const said = l.answers.length ? tally(l.answers) : '';
    const what = el('span', {}, name);
    if (said) what.append(el('small', {}, ` · ${said}`));
    head.append(el('h3', {}, l.name), what, fold);
    if (!isOpen) return [head];
    const since = el('p', { class: 'lawset', 'data-line': String(l.why) });
    since.append(`${l.since} `, why(l.why));
    return [
      head,
      settingRow(l, on, (id) => this.pick(l.id, id)),
      ...top(),
      el('p', { class: 'aside' }, l.about),
      since,
      ...body(),
    ];
  }

  private hours(view: LawView): HTMLElement[] {
    return [
      el('h4', {}, "The band's answers"),
      ...(view.answers.length
        ? answerRows(view.answers)
        : [
            el(
              'p',
              { class: 'muted' },
              'Everyone keeps the customary hours. There is nothing to weigh.',
            ),
          ]),
    ];
  }

  /** The Strangers law (P5.9): a custom for the colony, never a yes or no on one person. */
  private strangers(view: StrangersLawView): HTMLElement[] {
    const verdict: HTMLElement[] = [];
    if (view.verdict) {
      const box = el('div', { class: 'verdict', 'data-line': String(view.verdict.why) });
      const p = el('p', {});
      p.append(`${view.verdict.text} `, why(view.verdict.why));
      box.append(p);
      verdict.push(box);
    }
    return [
      ...verdict,
      ...(view.answers.length
        ? [el('h4', {}, "The band's answers"), ...answerRows(view.answers)]
        : []),
    ];
  }

  /** Rations, Sickness and Punishment (P6.5): the custom asks nothing of anyone. */
  private ruled(view: RuledLawView): HTMLElement[] {
    return view.answers.length
      ? [el('h4', {}, "The band's answers"), ...answerRows(view.answers)]
      : [
          el(
            'p',
            { class: 'muted' },
            'The custom asks nothing of anyone. There is nothing to weigh.',
          ),
        ];
  }
}
