// The person sheet's Health tab (P5.6, P5.8): a six-part body figure, the state in words, the Blood bar
// with its faint line, the wounds and lasting marks, each with "why?"; and, in test mode only,
// the Hurt tool (V-041). Indirect control (V-015, V-041): nothing here orders the hurt or the dead
// about. The words are the worker's (`HealthView`), the page only shows them (GAME-02).
import { content } from '../content/index.ts';
import type { HealthView, LedgerLine, PersonView } from '../worker/index.ts';
import { el } from './dom.ts';

const SVG = 'http://www.w3.org/2000/svg';
const PARTS: Readonly<Record<string, [number, number, number, number, number?]>> = {
  // x, y, width, height, corner (the head is a circle). Facing us, their left is our right.
  head: [30, 4, 24, 24, 12],
  body: [24, 32, 36, 52, 6],
  'left-arm': [63, 34, 13, 44, 5],
  'right-arm': [8, 34, 13, 44, 5],
  'left-leg': [43, 88, 15, 56, 5],
  'right-leg': [26, 88, 15, 56, 5],
};

/** The figure: each part filled by its status (red bleeding, amber healing, hatched lasting). */
function figure(parts: HealthView['parts'] | undefined): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 84 148');
  svg.setAttribute('class', 'figure');
  svg.setAttribute('role', 'img');
  svg.setAttribute('data-testid', 'figure');
  const status = (id: string) => parts?.find((q) => q.id === id)?.status ?? 'none';
  svg.setAttribute(
    'aria-label',
    content.health.parts.map((q) => `${q.name}: ${status(q.id)}`).join(', '),
  );
  svg.innerHTML =
    '<defs><pattern id="vlc-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#efe2c2"/><rect width="2" height="5" fill="#5a4630"/></pattern></defs>';
  for (const part of content.health.parts) {
    const [x, y, w, h, r = 4] = PARTS[part.id] ?? [0, 0, 0, 0];
    const rect = document.createElementNS(SVG, 'rect');
    for (const [k, v] of Object.entries({ x, y, width: w, height: h, rx: r, ry: r }))
      rect.setAttribute(k, String(v));
    rect.setAttribute('class', `part ${status(part.id)}`);
    rect.setAttribute('data-part', part.id);
    svg.append(rect);
  }
  return svg;
}

const legend = (): HTMLElement => {
  const row = el('p', { class: 'legend' });
  for (const k of ['bleeding', 'healing', 'lasting'])
    row.append(el('span', { class: `key ${k}` }), ` ${k} `);
  return row;
};

/** The Blood row: name, bar with the faint line, the word. Filled in place by `fillBlood`. */
function bloodRow(): HTMLElement {
  const row = el('div', { class: 'skills numbers need', 'data-testid': 'blood' });
  const bar = el('span', { class: 'sbar', role: 'img' });
  bar.append(el('i'), el('b'));
  row.append(el('span', {}, 'Blood'), bar, el('span', { class: 'n' }));
  return row;
}

/** Moves the Blood bar to the snapshot's figures, without redrawing the tab. */
export function fillBlood(row: HTMLElement | undefined, h: HealthView | undefined): void {
  if (!row) return;
  const full = content.health.blood.full;
  const share = h?.blood.share ?? 100;
  const line = h?.blood.line ?? Math.round((content.health.blood.faint * 100) / full);
  const [, bar, word] = [...row.children] as HTMLElement[];
  row.classList.toggle('low', !!h?.blood.low);
  bar!.setAttribute('aria-label', `Blood ${share} of 100, faint under ${line}`);
  (bar!.children[0] as HTMLElement).style.width = `${share}%`;
  (bar!.children[1] as HTMLElement).style.left = `${line}%`;
  word!.textContent = h?.blood.word ?? content.health.words['bloodWell'] ?? '';
}

/** What the open tab shows apart from the blood figure, which moves every hour. */
export const healthKey = (h: HealthView | undefined): string =>
  JSON.stringify(h && { ...h, blood: { word: h.blood.word, low: h.blood.low } });

const whyButton = (id: number): HTMLElement =>
  el('button', { type: 'button', class: 'why', 'data-why': String(id) }, 'why?');

export interface HealthSources {
  /** The ledger lines the page holds, to show the death line itself. */
  lines(): readonly LedgerLine[];
  lineRow(line: LedgerLine): HTMLElement;
  /** Test mode only: a wound given by hand (the `hurt` command). */
  hurt?(person: number, part: string, severity: string): void;
}

/** The tab's rows for `p`; `h` is none for someone never hurt. */
export function healthBody(
  p: PersonView,
  h: HealthView | undefined,
  src: HealthSources,
): HTMLElement[] {
  const top = el('div', { class: 'hhead' });
  const side = el('div');
  side.append(
    el(
      'p',
      { class: 'hstate', 'data-testid': 'health-state' },
      h?.text ?? content.health.words['well'] ?? '',
    ),
    legend(),
  );
  top.append(figure(h?.parts), side);
  const out: HTMLElement[] = [top];
  const dead = h?.badge === 'dead' || h?.buried;
  if (!dead) {
    out.push(
      bloodRow(),
      el('p', { class: 'aside' }, 'The red tick is the warning line: under it they faint.'),
    );
  }
  const death = h?.death && src.lines().find((l) => l.id === h.death);
  if (death) out.push(src.lineRow(death));
  else if (h?.death)
    out.push(
      el(
        'p',
        {},
        el('button', { type: 'button', class: 'why', 'data-why': String(h.death) }, 'why?'),
      ),
    );
  out.push(el('h3', {}, 'Wounds'));
  if (!h?.wounds.length) out.push(el('p', { class: 'muted' }, 'No open wounds.'));
  for (const w of h?.wounds ?? []) {
    const box = el('div', { class: 'wound', 'data-testid': 'wound', 'data-line': String(w.why) });
    const cause = el('p', { class: 'aside' }, `${w.cause} `);
    cause.append(whyButton(w.why));
    box.append(el('b', {}, w.title), el('p', {}, w.status), cause);
    out.push(box);
  }
  out.push(el('h3', {}, 'Lasting marks'));
  if (!h?.marks.length)
    out.push(el('p', { class: 'muted' }, h?.hint ? `None yet. ${h.hint}` : 'None.'));
  for (const m of h?.marks ?? []) {
    const box = el('div', { class: 'wound', 'data-line': String(m.why) });
    const story = el('p', { class: 'aside' }, `${m.story} `);
    story.append(whyButton(m.why));
    box.append(el('b', {}, m.title), el('p', {}, m.effect), story);
    out.push(box);
  }
  if (src.hurt && !dead) out.push(hurtTool(p, src.hurt));
  return out;
}

/** The test-mode Hurt tool: a part, a severity and a Hurt button, in a red TEST MODE row. */
function hurtTool(p: PersonView, hurt: NonNullable<HealthSources['hurt']>): HTMLElement {
  const part = el('select', { 'aria-label': 'Part' });
  for (const q of content.health.parts) part.append(el('option', { value: q.id }, q.name));
  const severity = el('select', { 'aria-label': 'Severity' });
  for (const s of content.health.severities) severity.append(el('option', { value: s.id }, s.name));
  const go = el('button', { type: 'button', 'data-testid': 'hurt-go' }, 'Hurt');
  go.addEventListener('click', () => hurt(p.id, part.value, severity.value));
  const head = el('p', {}, 'Test tools');
  head.append(el('span', { class: 'tag', 'data-testid': 'hurt-tool' }, 'TEST MODE'));
  const row = el('div', { class: 'row hurtrow' });
  row.append(part, severity, go);
  const box = el('div', { class: 'hurttool' });
  box.append(head, row);
  return box;
}
