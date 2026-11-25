import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FromWorker, SaveFile } from '../worker/index.ts';

// The page's tab-close copy (the flaky reload check, smoke.spec.ts, 2026-11-21 and 2026-11-23): a
// copy held until the page went and written then was lost under load, so each copy is written as
// it comes, and a slower autosave must not overwrite a newer copy.
const puts: { tick: number; auto: boolean; thumbnail: string }[] = [];
const store = {
  put: async (meta: (typeof puts)[number]) => void puts.push(meta),
  list: async () => [],
};
vi.mock('../persist/index.ts', () => ({
  openSaves: () => Promise.resolve(store),
  download: () => {},
  gzip: async () => new Blob(),
}));
vi.stubGlobal('document', { hidden: false, documentElement: { dataset: {} }, activeElement: null });
vi.stubGlobal('HTMLInputElement', class {});

const { Saves } = await import('./saves.ts');

const clock = { day: 1, monthName: 'Thawmonth', year: 1 };
const saved = (tick: number, standby = false) =>
  ({
    type: 'saved',
    auto: true,
    ...(standby && { standby: true }),
    save: { seed: 'smoke/2', tick } as SaveFile,
    clock,
  }) as Extract<FromWorker, { type: 'saved' }>;

/** A running world past its first tick, with a picture that takes `picture` to draw. */
async function running(picture: Promise<string>) {
  const sent: unknown[] = [];
  const saves = new Saves({
    seed: 'smoke',
    renderer: { thumbnail: () => picture },
    hud: {},
    panel: { kind: 'map', addLines: () => {} },
    send: (m: unknown) => sent.push(m),
    speed: () => 3,
    setSpeed: () => {},
    running: () => true,
  } as unknown as ConstructorParameters<typeof Saves>[0]);
  await Promise.resolve();
  saves.seen(100);
  saves.seen(140);
  return { saves, sent };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the standby copy', () => {
  beforeEach(() => void (puts.length = 0));

  it('is written as it comes, with the last picture, and counted once written', async () => {
    const { saves } = await running(Promise.resolve('picture'));
    saves.handle(saved(120));
    await settle();
    saves.handle(saved(140, true));
    expect(document.documentElement.dataset['standby']).toBeUndefined();
    await settle();
    expect(puts.map((p) => [p.tick, p.thumbnail])).toEqual([
      [120, 'picture'],
      [140, 'picture'],
    ]);
    expect(document.documentElement.dataset['standby']).toBe('1');
    saves.stop();
  });

  it('is written although a newer autosave is still waiting on its picture', async () => {
    const { saves, sent } = await running(new Promise(() => {}));
    saves.handle(saved(140, true));
    saves.seen(150);
    saves.autosave();
    expect(sent).toEqual([{ type: 'save', auto: true }]);
    saves.handle(saved(150));
    await settle();
    expect(puts.map((p) => p.tick)).toEqual([140]);
    saves.stop();
  });

  it('is not overwritten by an older autosave that lands after it', async () => {
    let draw = (_: string) => {};
    const { saves } = await running(new Promise((resolve) => (draw = resolve)));
    saves.handle(saved(140));
    saves.handle(saved(150, true));
    await settle();
    draw('');
    await settle();
    expect(puts.map((p) => p.tick)).toEqual([150]);
    saves.stop();
  });
});
