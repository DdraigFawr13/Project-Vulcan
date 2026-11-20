// The tavern on the page (6B Bundle 5, V-188): the Build sheet's Tavern row says why it waits, then
// where it stands; the tavern tile's page names it, its keeper, the ale in its casks and who is in;
// the Ale stock line counts the cups. All words of the engine's state (GAME-02).
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  addEntity,
  buildSystem,
  cupsHeld,
  createSim,
  createWorld,
  fillCask,
  finishPlan,
  plansOf,
  rectOf,
  roomAt,
  step,
  tavernHouse,
  tavernOf,
  TICKS_PER_HOUR,
  withoutAccidents,
  type SimEvent,
  type Stub,
} from '../engine/index.ts';
import { contextFor } from '../engine/sim/system.ts';
import { stockView } from './goods.ts';
import { tavernPlace, tavernRow } from './tavern.ts';

const lineOf = (e: SimEvent | Stub) => ({ id: e.id, text: e.type }) as never;

describe('the tavern on the page', () => {
  it('waits for the harvest home, then shows the tavern, its casks and the Ale line', () => {
    const sim = createSim(withoutAccidents(content));
    const w = createWorld(sim, 'anvil');
    step(w, sim, TICKS_PER_HOUR);
    expect(tavernRow(w).need).toBe('waits for the first harvest home');
    addEntity(w, 'feast', {
      ...{ line: w.begunEvent, year: 1, state: 'eaten', start: 0, there: [], eaten: w.begunEvent },
      ...{ couple: [], on: 0, holy: 0, lean: 0 },
    });
    addEntity(w, 'want', { kind: 'tavern', level: 1, line: 0 });
    for (let h = 0; h < 3 && !tavernHouse(w); h += 1) step(w, sim, TICKS_PER_HOUR);
    const h = tavernHouse(w)!;
    expect(tavernRow(w).plan).toMatchObject({ id: h.id, sent: false });
    expect(tavernRow(w).plan!.words).toMatch(/^A longhouse .+ of the green: planned\.$/);
    const ctx = contextFor(w, sim, buildSystem);
    for (const p of plansOf(w).filter((r) => r['house'] === h.id))
      finishPlan(ctx, p, h['line'] as number);
    step(w, sim, TICKS_PER_HOUR);
    const r = rectOf(h);
    const room = roomAt(w, content, r.x + 1, r.y + 1)!;
    const at = (k: number) => ({
      x: room.tiles[k]! % w.map.width,
      y: Math.floor(room.tiles[k]! / w.map.width),
    });
    const cask = addEntity(w, 'furniture', {
      ...{ kind: 'ale-cask', ...at(0), z: 0, facing: 's', quality: 0, maker: 0, owner: 0 },
      ...{
        made: h['line'] as number,
        line: h['line'] as number,
        state: 'built',
        have: 0,
        work: 0,
        waited: 0,
      },
    });
    fillCask(w, cask, { drink: 'ale', cups: 14, ready: w.tick, line: h['line'] as number });
    step(w, sim, 1);
    const name = tavernOf(w)!['name'] as string;
    expect(tavernRow(w).need).toMatch(new RegExp(`^${name} stands; \\d+ cups in its casks$`));
    const page = tavernPlace(w, at(0).x, at(0).y, lineOf).place!;
    expect(page.name).toBe(name);
    const rows = Object.fromEntries(page.rows);
    expect(rows['ale']).toMatch(/^\d+ cups? ready in 1 cask/);
    expect(rows['innkeeper']).not.toBe('');
    expect(rows['this week']).toMatch(/^\d+ tales? told, \d+ songs? sung$/);
    expect(page.lines.map((l) => l.label)).toContain('Named · ');
    // Outside the tavern, no tavern page.
    expect(tavernPlace(w, r.x - 2, r.y - 2, lineOf)).toEqual({});
    // The Ale line counts the cups in the casks, not the store.
    const ale = stockView(w).find((g) => g.good === content.tavern.stock)!;
    expect(ale.have).toBe(cupsHeld(w));
    expect(ale.have).toBeGreaterThan(0);
  });
});
