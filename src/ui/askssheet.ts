// The Asks sheet (6C Slice 4, V-237), first under ⋯: who wants something of the colony and what
// answering brings or costs. The colony answers as a colony (V-041): Take up puts an ask into the
// work at second, the Work sheet's 1 to 4 stepper then moves it, and Let pass lets it go; a guest's
// ask is yes or no. Nothing here names who works it. Every word is the worker's `AsksView`.
import type { AskCardView, AsksView, LedgerLine } from '../worker/index.ts';
import { el } from './dom.ts';
import type { Panel } from './panel.ts';
import { stepper, WORDS } from './stepper.ts';

export interface AsksActions {
  /** `takeAsk {ask, level}`: taken up, or moved, at priority `level`. */
  take(ask: number, level: number): void;
  /** `passAsk {ask}`. */
  pass(ask: number): void;
  lineRow(line: LedgerLine): HTMLElement;
}

/** Take up goes in at second (q2 A). */
const TAKE_AT = 2;

const why = (line: number): HTMLElement =>
  el('button', { type: 'button', class: 'why', 'data-why': String(line) }, 'why?');

const plate = (label: string, test: string, onClick: () => void): HTMLElement => {
  const b = el('button', { type: 'button', class: 'word', 'data-testid': test }, label);
  b.addEventListener('click', onClick);
  return b;
};

function heading(text: string, count: number, test: string, hot = false): HTMLElement {
  const h = el('h3', { class: 'askhead', 'data-testid': test }, text);
  if (count) h.append(el('span', { class: hot ? 'tally hot' : 'tally' }, String(count)));
  return h;
}

/** One ask: who and why, what and by when, the costs, then its buttons. */
function card(c: AskCardView, act: AsksActions): HTMLElement {
  const box = el('div', { class: 'ask', 'data-testid': `ask-${c.id}`, 'data-state': c.state });
  const who = el('p', { class: 'askwho' });
  who.append(el('b', {}, c.asker), el('i', {}, ` · ${c.about} `), why(c.why));
  box.append(who, el('p', { class: 'asksays' }, c.says));
  const notes = [c.answerBy, c.progress, c.costs, c.work].filter(Boolean);
  for (const n of notes) box.append(el('p', { class: 'aside' }, n));
  const row = el('div', { class: 'askbtns' });
  if (c.state === 'taken' && !c.yesNo)
    row.append(
      stepper(c.level, WORDS[c.level - 1] ?? '', `The ask of ${c.asker}`, (level) =>
        act.take(c.id, level),
      ),
    );
  else if (c.state !== 'taken')
    row.append(plate('Take up', 'ask-take', () => act.take(c.id, TAKE_AT)));
  if (c.state !== 'passed') row.append(plate('Let pass', 'ask-pass', () => act.pass(c.id)));
  box.append(row);
  return box;
}

/** The sheet's rows: waiting, taken up, let pass till their day, and the last three closed. */
export function asksRows(view: AsksView, act: AsksActions): HTMLElement[] {
  const rows: HTMLElement[] = [
    el(
      'p',
      { class: 'aside' },
      'Who wants something of the colony. Take an ask up and give it a place in the work, or ' +
        'let it pass. The colony chooses who works it.',
    ),
  ];
  const live = view.open.length + view.taken.length + view.passed.length;
  if (!live && !view.closed.length)
    return [...rows, el('p', { class: 'muted' }, 'Nobody has asked the colony for anything yet.')];
  if (view.open.length) {
    rows.push(heading('Waiting for your answer', view.waiting, 'asks-waiting', true));
    rows.push(...view.open.map((c) => card(c, act)));
  }
  if (view.taken.length) {
    rows.push(heading('Taken up', view.taken.length, 'asks-taken'));
    rows.push(...view.taken.map((c) => card(c, act)));
  }
  if (view.passed.length) {
    rows.push(heading('Let pass, till their day', view.passed.length, 'asks-passed'));
    rows.push(...view.passed.map((c) => card(c, act)));
  }
  if (view.closed.length) {
    rows.push(heading('Answered and closed', 0, 'asks-closed'));
    rows.push(...view.closed.map((l) => act.lineRow(l)));
    rows.push(el('p', { class: 'aside' }, 'Older asks are in the Ledger.'));
  }
  return rows;
}

/** Draws the sheet in the panel; its levers go out through `send` as commands for the next tick,
 * applied at once while paused. */
export function showAsks(
  panel: Panel,
  view: AsksView,
  send: (kind: string, data: Record<string, number>) => void,
): void {
  panel.showView(
    'asks',
    'Asks',
    asksRows(view, {
      take: (ask, level) => send('takeAsk', { ask, level }),
      pass: (ask) => send('passAsk', { ask }),
      lineRow: (line) => panel.lineRow(line),
    }),
  );
}
