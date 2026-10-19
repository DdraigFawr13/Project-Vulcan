// The Laws sheet (P4.8): what the colony expects, as a setting the player picks, and how each
// person weighs it. A law is a lever, never an order: people obey, grumble or refuse (V-091).
// The setting applies at once while paused and shows as sent until the snapshot carries it.
// Everything shown comes from the worker's `LawView` (GAME-02).
import type { AnswerView, LawView } from '../worker/index.ts';
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

/** "1 refuses, 2 grumble, 2 obey. Refusals first." */
function countLine(answers: readonly AnswerView[]): string {
  const n = (a: AnswerView['answer']) => answers.filter((x) => x.answer === a).length;
  const verb = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`;
  const parts = [
    n('refuses') && verb(n('refuses'), 'refuses', 'refuse'),
    n('grumbles') && verb(n('grumbles'), 'grumbles', 'grumble'),
    n('obeys') && verb(n('obeys'), 'obeys', 'obey'),
  ].filter(Boolean);
  return `${parts.join(', ')}. Refusals first.`;
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

export class LawSheet {
  /** The setting sent and not yet seen in a snapshot. */
  private pending: string | undefined;
  private readonly actions: LawActions;
  constructor(actions: LawActions) {
    this.actions = actions;
  }

  /** A key for what the sheet shows, so it is redrawn only when that changes. */
  key(view: LawView): string {
    if (this.pending === view.setting) this.pending = undefined;
    return JSON.stringify([view, this.pending]);
  }

  rows(view: LawView): HTMLElement[] {
    const on = this.pending ?? view.setting;
    const settings = el('div', { class: 'row', role: 'group', 'aria-label': `${view.name} law` });
    for (const s of view.settings) {
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
      b.addEventListener('click', () => {
        if (s.id === on) return;
        this.pending = s.id;
        this.actions.setLaw(view.id, s.id);
        this.actions.refresh();
      });
      settings.append(b);
    }
    const since = el('p', { class: 'lawset', 'data-line': String(view.why) });
    since.append(`${view.since} `, why(view.why));
    const answers: HTMLElement[] = view.answers.length
      ? [
          el('p', { class: 'aside' }, countLine(view.answers)),
          ...GROUPS.flatMap(([id, name]) => {
            const mine = view.answers.filter((a) => a.answer === id);
            return mine.length ? [el('p', { class: 'group' }, name), ...mine.map(answerBlock)] : [];
          }),
        ]
      : [
          el(
            'p',
            { class: 'muted' },
            'Everyone keeps the customary hours. There is nothing to weigh.',
          ),
        ];
    return [
      el(
        'p',
        { class: 'aside' },
        'A law says what the colony expects. Each person weighs it for themselves: they obey, grumble, or refuse and keep the customary hours. Nobody is made to.',
      ),
      el('h3', {}, view.name),
      settings,
      ...dayStrip(view.hours),
      el('p', { class: 'aside' }, view.about),
      since,
      el('h3', {}, "The band's answers"),
      ...answers,
    ];
  }
}
