// A grave, the burial ground and the dead on the page (P5.8): the grave's tile page with who lies
// there, who dug it and who mourned, the ground's own page, the Build sheet's one Send back until
// the first grave is dug, and the buried left out of the map.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  createSim,
  createWorld,
  step,
  submitCommand,
  withoutAccidents,
  type SimEvent,
  type Stub,
} from '../engine/index.ts';
import { burialRow, tilePlace, withLying } from './places.ts';
import { goodsOf } from './goods.ts';
import { walkersOf } from './people.ts';

const DAY = 1440;
const sim = createSim({
  ...withoutAccidents(content),
  health: {
    ...content.health,
    accidents: [],
    severities: content.health.severities.map((s) =>
      s.id === 'grave' ? { ...s, mortal: 100 } : s,
    ),
  },
});
const lineOf = (e: SimEvent | Stub) =>
  ({
    id: e.id,
    tick: e.tick,
    type: e.type,
    text: e.type,
    clock: { day: 4, monthName: 'Leaffall', year: 1 },
  }) as never;

describe('grave and burial ground views', () => {
  it('words the grave and the ground, offers Send back until a grave is dug, and hides the buried', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, DAY / 2);
    expect(burialRow(w)).toBeUndefined();
    const p = w.entities['person']![2]!;
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'hurt',
      data: { person: p.id, part: 'body', severity: 'grave' },
    });
    for (let k = 0; k < 24 && p['status'] === 'alive'; k += 1) step(w, sim, 60);
    step(w, sim, 120);
    // Dead, unburied: the ground is laid and can be sent back; the body is drawn lying.
    expect(burialRow(w)).toMatchObject({ back: true, sent: false, graves: 0 });
    expect(withLying(w, walkersOf(w)).find((x) => x.id === p.id)?.lying).toBe('dead');
    for (let d = 0; d < 4 && p['status'] !== 'buried'; d += 1) step(w, sim, DAY);
    expect(p['status']).toBe('buried');
    expect(burialRow(w)).toMatchObject({ back: false, sent: false, graves: 1 });
    expect(withLying(w, walkersOf(w)).find((x) => x.id === p.id)?.lying).toBe('buried');

    const grave = w.entities['grave']![0]!;
    const [gx, gy] = [grave['x'] as number, grave['y'] as number];
    expect(goodsOf(w).graves).toEqual([
      { x: gx, y: gy, z: 0, dug: false, marker: grave['marker'] === 1 },
    ]);
    const page = tilePlace(w, gx, gy, lineOf).place!;
    expect(page.name).toBe('Grave');
    expect(page.who).toContain(p['name'] as string);
    expect(page.about).toContain('Lies here since 4 Leaffall, year 1.');
    expect(page.rows.map(([k]) => k)).toEqual(
      expect.arrayContaining(['buried by', 'marker', 'mourners']),
    );
    expect(page.lines.map((l) => l.label)).toEqual(
      expect.arrayContaining(['Died · ', 'Buried · ', 'Burial ground · ']),
    );

    const ground = w.entities['burial']![0]!;
    const other = [0, 1, 2, 3]
      .map((dx) => ({ x: (ground['x'] as number) + dx, y: ground['y'] as number }))
      .find((t) => t.x !== gx || t.y !== gy)!;
    const plots = (ground['w'] as number) * (ground['h'] as number);
    const open = tilePlace(w, other.x, other.y, lineOf).place!;
    expect(open.name).toBe('Burial ground');
    expect(open.rows.at(-1)).toEqual(['plots', `${plots - 1} of ${plots} plots free`]);
  });
});
