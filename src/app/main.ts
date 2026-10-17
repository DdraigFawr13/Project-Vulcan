// The viewer: time controls, the canvas map, colonist list, inspector and chronicle. It shows
// what the worker reports and never recomputes a rule (GAME-02).

import './style.css';
import { defaultContent as content } from '../content/index.ts';
import { clockAt, isNight, type Colony } from '../engine/index.ts';
import { SimHost } from '../platform/host.ts';
import {
  SPEEDS,
  type ColonistView,
  type FromWorker,
  type LoggedEvent,
} from '../platform/protocol.ts';
import { TILE, colonistColour, drawScene, type MapImage } from './draw.ts';

/** Chronicle lines kept on screen; the full log stays in the worker for export. */
const LOG_LIMIT = 300;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('map');
const ctx = canvas.getContext('2d')!;
const clock = $('clock');
const playButton = $<HTMLButtonElement>('play');
const speedGroup = $('speeds');
const seedInput = $<HTMLInputElement>('seed');
const colonyLine = $('colony');
const list = $('colonists');
const inspector = $('inspector');
const logList = $('log');
const eventCount = $('event-count');
const routineToggle = $<HTMLInputElement>('routine');

interface State {
  map: MapImage | null;
  seed: string;
  tick: number;
  running: boolean;
  speed: number;
  colonists: ColonistView[];
  colony: Colony | null;
  feature: Uint8Array;
  amount: Uint8Array;
  log: LoggedEvent[];
  selected: number | null;
}

const state: State = {
  map: null,
  seed: '',
  tick: 0,
  running: true,
  speed: 1,
  colonists: [],
  colony: null,
  feature: new Uint8Array(),
  amount: new Uint8Array(),
  log: [],
  selected: null,
};

const host = new SimHost(onMessage);

function onMessage(message: FromWorker): void {
  switch (message.type) {
    case 'world':
      state.map = { width: message.width, height: message.height, terrain: message.terrain };
      state.seed = message.seed;
      state.log = [];
      state.selected = null;
      list.replaceChildren();
      canvas.width = message.width * TILE;
      canvas.height = message.height * TILE;
      seedInput.value = message.seed;
      return;
    case 'frame':
      state.tick = message.tick;
      state.running = message.running;
      state.speed = message.speed;
      state.colonists = message.colonists;
      state.colony = message.colony;
      state.feature = message.feature;
      state.amount = message.amount;
      state.log.push(...message.events);
      if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
      eventCount.textContent = `${message.eventCount} events`;
      render(message.events.length > 0);
      return;
    case 'export':
      download(`ledger-${message.seed}-events.ndjson`, message.ndjson);
      return;
  }
}

function timeText(tick: number): string {
  const { day, hour, minute } = clockAt(tick, content.tuning);
  return `Day ${day}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function render(logChanged: boolean): void {
  if (!state.map || !state.colony) return;
  clock.textContent = timeText(state.tick);
  playButton.textContent = state.running ? 'Pause' : 'Play';
  for (const button of speedGroup.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === state.speed));
  }
  drawScene(ctx, {
    map: state.map,
    feature: state.feature,
    amount: state.amount,
    colonists: state.colonists,
    colony: state.colony,
    night: isNight(state.tick, content.tuning),
    selected: state.selected,
  });
  const { stock, hearthFuel } = state.colony;
  const hearth =
    hearthFuel > 0
      ? `hearth lit (${Math.ceil(hearthFuel / content.tuning.ticksPerHour)} h of fuel)`
      : 'hearth out';
  colonyLine.textContent = `Store: ${stock.food} meals, ${stock.wood} wood · ${hearth}`;
  renderList();
  renderInspector();
  if (logChanged) renderLog();
}

/** Rows are built once per colony and updated in place, so a click never lands on a stale row. */
function renderList(): void {
  if (list.children.length !== state.colonists.length) {
    list.replaceChildren(
      ...state.colonists.map((c) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        const name = document.createElement('span');
        name.textContent = c.name;
        name.style.color = colonistColour(c.id);
        name.style.fontWeight = '600';
        const activity = document.createElement('span');
        activity.className = 'activity';
        button.append(name, activity);
        button.onclick = () => select(c.id === state.selected ? null : c.id);
        item.append(button);
        return item;
      }),
    );
  }
  state.colonists.forEach((c, index) => {
    const button = list.children[index]!.firstElementChild!;
    button.setAttribute('aria-pressed', String(c.id === state.selected));
    button.lastElementChild!.textContent = c.activity;
  });
}

function renderInspector(): void {
  const c = state.colonists.find((entry) => entry.id === state.selected);
  inspector.hidden = !c;
  if (!c) return;
  const max = content.tuning.needMax;
  const needs = (['food', 'rest', 'company'] as const).map((need) => {
    const row = document.createElement('div');
    row.className = 'need';
    const label = document.createElement('span');
    label.textContent = need;
    const meter = document.createElement('meter');
    meter.min = 0;
    meter.max = max;
    meter.low = content.tuning.lowAt[need];
    meter.high = max * 0.75;
    meter.optimum = max;
    meter.value = c.needs[need];
    meter.setAttribute('aria-label', `${need} ${c.needs[need]} of ${max}`);
    const value = document.createElement('span');
    value.textContent = String(c.needs[need]);
    row.append(label, meter, value);
    return row;
  });
  const facts = document.createElement('dl');
  const job = content.jobs.find((entry) => entry.id === c.likes);
  for (const [term, detail] of [
    ['Doing', c.activity],
    [
      'Carrying',
      c.carrying ? `${c.carrying.amount} ${content.resourceWords[c.carrying.resource]}` : 'nothing',
    ],
    ['Likes', job?.label ?? c.likes],
    ['At', `${c.x}, ${c.y}`],
  ] as const) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = detail;
    facts.append(dt, dd);
  }
  const heading = document.createElement('h2');
  heading.textContent = c.name;
  heading.style.color = colonistColour(c.id);
  const recentHeading = document.createElement('h2');
  recentHeading.textContent = 'Recent';
  const recent = document.createElement('ol');
  for (const event of state.log
    .filter((e) => e.actors.includes(c.id))
    .slice(-12)
    .reverse()) {
    recent.append(logLine(event));
  }
  inspector.replaceChildren(heading, ...needs, facts, recentHeading, recent);
}

function renderLog(): void {
  const showRoutine = routineToggle.checked;
  const lines = state.log
    .filter((event) => showRoutine || (content.events[event.type]?.importance ?? 1) > 1)
    .slice(-150)
    .reverse()
    .map(logLine);
  logList.replaceChildren(...lines);
}

function logLine(event: LoggedEvent): HTMLLIElement {
  const item = document.createElement('li');
  item.dataset.type = event.type;
  if ((content.events[event.type]?.importance ?? 1) > 1) item.className = 'notable';
  const time = document.createElement('time');
  time.textContent = timeText(event.tick).replace('Day ', 'D');
  item.append(time, `#${event.id} ${event.text}`);
  if (event.causes.length) {
    const why = document.createElement('span');
    why.className = 'why';
    why.textContent = ` (because #${event.causes.join(', #')})`;
    item.append(why);
  }
  return item;
}

function select(id: number | null): void {
  state.selected = id;
  render(false);
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/x-ndjson' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// ---- Controls ----

for (const speed of SPEEDS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `${speed}×`;
  button.dataset.speed = String(speed);
  button.setAttribute('aria-label', `Speed ${speed} times`);
  button.onclick = () => host.speed(speed);
  speedGroup.append(button);
}
playButton.onclick = () => (state.running ? host.pause() : host.play());
$('step').onclick = () => {
  if (state.running) host.pause();
  host.step(content.tuning.ticksPerHour);
};
$('export').onclick = () => host.requestExport();
routineToggle.onchange = () => renderLog();
$<HTMLFormElement>('seed-form').onsubmit = (event) => {
  event.preventDefault();
  startColony(seedInput.value.trim() || randomSeed());
};
canvas.onclick = (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((((event.clientX - rect.left) / rect.width) * canvas.width) / TILE);
  const y = Math.floor((((event.clientY - rect.top) / rect.height) * canvas.height) / TILE);
  const hit = state.colonists.find((c) => Math.abs(c.x - x) <= 1 && Math.abs(c.y - y) <= 1);
  select(hit ? hit.id : null);
};
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === 'Space') {
    event.preventDefault();
    playButton.click();
  }
  const index = Number(event.key) - 1;
  const speed = SPEEDS[index];
  if (speed !== undefined) host.speed(speed);
});

/** The UI may pick a seed at random; the engine only ever receives it as a string. */
function randomSeed(): string {
  return Math.floor(Math.random() * 1e9).toString(36);
}

function startColony(seed: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  window.history.replaceState(null, '', url);
  host.init(seed);
}

const params = new URLSearchParams(window.location.search);
if (params.get('paused') === '1') host.pause();
startColony(params.get('seed') || 'vulcan');
