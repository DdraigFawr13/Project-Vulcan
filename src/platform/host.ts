// UI-side handle on the simulation worker.

import type { FromWorker, Speed, ToWorker } from './protocol.ts';

export class SimHost {
  private readonly worker: Worker;

  constructor(onMessage: (message: FromWorker) => void) {
    this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<FromWorker>) => onMessage(event.data);
  }

  private send(message: ToWorker): void {
    this.worker.postMessage(message);
  }

  init(seed: string): void {
    this.send({ type: 'init', seed });
  }
  play(): void {
    this.send({ type: 'play' });
  }
  pause(): void {
    this.send({ type: 'pause' });
  }
  speed(speed: Speed): void {
    this.send({ type: 'speed', speed });
  }
  step(ticks: number): void {
    this.send({ type: 'step', ticks });
  }
  requestExport(): void {
    this.send({ type: 'export' });
  }
}
