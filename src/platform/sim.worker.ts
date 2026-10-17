// The simulation worker: owns the world, runs a fixed tick at the chosen speed, and posts a
// frame to the UI after each batch. Pause and speed change how many ticks run per real
// second, never what a tick does, so a run is the same at any speed.

import { defaultContent as content } from '../content/index.ts';
import {
  createWorld,
  describeTask,
  renderEvent,
  step,
  type SimEvent,
  type WorldState,
} from '../engine/index.ts';
import { MemoryEventLog } from './event-log.ts';
import {
  BASE_TICKS_PER_SECOND,
  type FromWorker,
  type LoggedEvent,
  type Speed,
  type ToWorker,
} from './protocol.ts';

const FRAME_MS = 50;
/** Upper bound on ticks per frame so a stalled tab never runs a long burst. */
const MAX_TICKS_PER_FRAME = 200;

let world: WorldState | null = null;
let log = new MemoryEventLog();
let running = true;
let speed: Speed = 1;
let owed = 0;
let last = performance.now();
let pending: LoggedEvent[] = [];

function post(message: FromWorker, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(message, transfer);
}

function record(events: readonly SimEvent[]): void {
  if (!world) return;
  const logged = events.map((event) => ({
    ...event,
    text: renderEvent(event, world!.colonists, content),
  }));
  log.append(logged);
  pending.push(...logged);
}

function sendFrame(): void {
  if (!world) return;
  const w = world;
  post({
    type: 'frame',
    tick: w.tick,
    running,
    speed,
    colonists: w.colonists.map((c) => ({ ...c, activity: describeTask(c, w.colonists, content) })),
    colony: w.colony,
    feature: w.map.feature.slice(),
    amount: w.map.amount.slice(),
    events: pending,
    eventCount: log.size,
  });
  pending = [];
}

function advance(ticks: number): void {
  if (!world || ticks <= 0) return;
  record(step(world, content, ticks));
}

self.onmessage = (message: MessageEvent<ToWorker>) => {
  const command = message.data;
  switch (command.type) {
    case 'init': {
      const created = createWorld(command.seed, content);
      world = created.world;
      log = new MemoryEventLog();
      pending = [];
      owed = 0;
      record(created.events);
      post({
        type: 'world',
        seed: world.seed,
        width: world.map.width,
        height: world.map.height,
        terrain: world.map.terrain.slice(),
      });
      break;
    }
    case 'play':
      running = true;
      last = performance.now();
      break;
    case 'pause':
      running = false;
      owed = 0;
      break;
    case 'speed':
      speed = command.speed;
      break;
    case 'step':
      advance(command.ticks);
      break;
    case 'export':
      if (world) post({ type: 'export', seed: world.seed, ndjson: log.toNdjson() });
      return;
  }
  sendFrame();
};

setInterval(() => {
  const now = performance.now();
  const elapsed = now - last;
  last = now;
  if (!running || !world) return;
  owed += (elapsed * BASE_TICKS_PER_SECOND * speed) / 1000;
  const ticks = Math.min(MAX_TICKS_PER_FRAME, Math.floor(owed));
  owed -= ticks;
  if (ticks === MAX_TICKS_PER_FRAME) owed = 0;
  advance(ticks);
  if (ticks > 0) sendFrame();
}, FRAME_MS);
