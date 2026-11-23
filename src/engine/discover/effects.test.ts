// 6C Slice 5 part 3 (V-219): a way's effect holds only for work its knower does themself: a tool
// a knower of steel made wears slower, a clamp a knower opens lays more charcoal, a wall a knower
// of lime mortar set leaks less heat, and a knower's skeps are lost less over the winter.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld } from '../index.ts';
import { burning } from '../crafts/index.ts';
import { addEntity } from '../entity/index.ts';
import { allLines, beesSystem, clockAt, TICKS_PER_DAY } from '../index.ts';
import { worked } from '../band/index.ts';
import { setMortar } from '../build/index.ts';
import { leakOf } from '../fire/index.ts';
import { HELD, layTool, restOf } from '../goods/index.ts';
import { contextFor } from '../sim/system.ts';

const sim = createSim(content);
type World = ReturnType<typeof createWorld>;
const people = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** anvil's band: a knower of `method` and a person who is not. */
function pair(method: string) {
  const w = createWorld(sim, 'anvil');
  const [knower, other] = people(w) as [(typeof w.entities)[string][number], never];
  addEntity(w, 'knows', {
    ...{ person: knower.id, method, how: 'found', line: allLines(w)[0]!.id, from: 0 },
  });
  return { w, knower, other: other as typeof knower };
}

describe('effects of the ways, for their knowers only', () => {
  it('wears a tool a knower of steel made at half the rate', () => {
    const { w, knower, other } = pair('steel');
    const ctx = contextFor(w, sim, beesSystem);
    const wear = (maker: typeof knower) => {
      const tool = layTool(w, content, restOf(w, content), {
        ...{ kind: 'axe', material: 'stone', quality: 'plain', made: 1, maker: maker.id },
      });
      Object.assign(tool, { owner: other.id, state: 'held', ...HELD });
      const before = tool['wear'] as number;
      for (let m = 0; m < 60; m += 1) worked(ctx, other, 'fell');
      Object.assign(tool, { owner: 0, state: '' });
      return before - (tool['wear'] as number);
    };
    expect(wear(other)).toBe(60);
    expect(wear(knower)).toBe(30);
  });

  it('lays a quarter more charcoal from a clamp a knower opens', () => {
    const { w, knower, other } = pair('clamp');
    const ctx = contextFor(w, sim, beesSystem);
    const clamp = addEntity(w, 'station', {
      ...{ kind: 'clamp', x: 1, y: 1, z: 0, w: 2, h: 2, state: 'lit', line: 1, have: 0 },
      ...{ work: -1, made: 0, lit: 0, litLine: 0, alert: 0, waitFor: '', sent: 0 },
    });
    const open = (p: typeof knower) => {
      Object.assign(p, { x: 0, y: 1, z: 0, job: 'charcoal', plan: clamp, make: 'open', work: 1 });
      Object.assign(
        w.entities['station']!.find((s) => s.id === clamp)!,
        { state: 'lit' },
      );
      burning(ctx, p);
      return lines(w, 'metal.charcoalMade').at(-1)!.data['count'];
    };
    const plain = content.metal.clamp.yield;
    expect(open(other)).toBe(plain);
    expect(open(knower)).toBe(plain + Math.round(plain * 0.25));
  });

  it('has a wall a knower of lime mortar set lose a third less heat', () => {
    const { w, knower, other } = pair('lime-mortar');
    const ctx = contextFor(w, sim, beesSystem);
    // A closed room of 3 by 3 tiles in stone walls, drawn on the map.
    const parts = content.buildings.parts;
    const stone = parts.findIndex((p) => p.id === 'wall-stone') + 1;
    const [cx, cy] = [Math.floor(w.map.width / 2), Math.floor(w.map.height / 2)];
    const walls: number[] = [];
    for (let y = cy - 2; y <= cy + 2; y += 1)
      for (let x = cx - 2; x <= cx + 2; x += 1)
        if (Math.abs(x - cx) === 2 || Math.abs(y - cy) === 2) {
          w.map.built[y * w.map.width + x] = stone;
          walls.push(y * w.map.width + x);
        }
    // A door in the north wall, so the walls close a room.
    const door = parts.findIndex((p) => p.id === 'door-wood') + 1;
    w.map.built[(cy - 2) * w.map.width + cx] = door;
    walls.splice(walls.indexOf((cy - 2) * w.map.width + cx), 1);
    const piece = { id: 0, x: cx, y: cy } as never;
    const leak = () => leakOf(w, content, piece);
    const bare = leak();
    const set = (who: number) => {
      for (const i of walls) setMortar(ctx, i % w.map.width, Math.floor(i / w.map.width), who);
    };
    set(other.id);
    expect(leak()).toBe(bare);
    set(knower.id);
    expect(leak()).toBeLessThan(bare);
    expect(leak()).toBeGreaterThanOrEqual(Math.floor((bare * 60) / 100));
  });

  it('loses skeps over the winter with a line, half as many of a knower of skeps', () => {
    const { w, knower, other } = pair('skeps');
    const ctx = contextFor(w, sim, beesSystem);
    const { month } = content.lamp.bees.winter;
    let tick = 0;
    while (
      clockAt(tick, content.calendar).day !== 1 ||
      content.calendar.monthNames[clockAt(tick, content.calendar).month] !== month
    )
      tick += TICKS_PER_DAY;
    w.tick = tick;
    const line = allLines(w)[0]!.id;
    const stand = (keeper: number) => {
      for (let n = 0; n < 200; n += 1)
        addEntity(w, 'skep', {
          ...{ x: n, y: 0, z: 0, field: 1, state: 'bees', line, harvested: 0, visited: 0 },
          keeper,
        });
    };
    stand(other.id);
    stand(knower.id);
    beesSystem.run!(ctx);
    const lost = (keeper: number) =>
      (w.entities['skep'] ?? []).filter((s) => s['keeper'] === keeper && s['state'] === 'empty')
        .length;
    expect(lost(other.id)).toBeGreaterThan(30);
    expect(lost(knower.id)).toBeGreaterThan(0);
    expect(lost(knower.id)).toBeLessThan(lost(other.id) * 0.75);
    const said = lines(w, 'bees.lost');
    expect(said.length).toBe(lost(other.id) + lost(knower.id));
    expect(said.every((e) => e.causes.includes(line) && e.actors.length === 1)).toBe(true);
  });
});
