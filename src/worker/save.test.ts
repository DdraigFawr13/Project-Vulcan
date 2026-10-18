// The save boundary: a save survives the browser's structured clone (what IndexedDB and
// postMessage do to it) whole, and one from other content, another format or damaged is refused.
import { serialize } from 'node:v8';
import { describe, expect, it } from 'vitest';
import { content, contentHash } from '../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  recordOf,
  SYSTEMS,
  step,
  submitCommand,
  TICKS_PER_DAY,
  toNdjson,
  type System,
} from '../engine/index.ts';
import { checkSave, SAVE_VERSION, saveOf, type SaveFile } from './save.ts';

// A test-only entity kind (P2.0): real kinds arrive with P2.1 (colonists) and P2.4 (items). Its
// first row remembers the world's first day line, so the seal must keep that line as a stub.
const keeper: System = {
  id: 'test-keeper',
  every: 'day',
  tables: { keeper: { name: 'text', memory: 'events', holder: 'entity', age: 'count' } },
  init: (ctx) => {
    const first = ctx.world.log.at(-1)!.id;
    addEntity(ctx.world, 'keeper', { name: 'Bryn', memory: [first], holder: 0, age: 30 });
    addEntity(ctx.world, 'keeper', { name: 'Celyn', memory: [], holder: 1, age: 4 });
  },
};
const sim = createSim(content, [...SYSTEMS, keeper]);
const world = createWorld(sim, 'save-test');
step(world, sim, 10 * TICKS_PER_DAY);

describe('saves', () => {
  it('round-trips a world through a structured clone unchanged', () => {
    const save = structuredClone(saveOf(world, contentHash));
    expect(save).toMatchObject({ version: SAVE_VERSION, seed: 'save-test', tick: world.tick });
    const loaded = checkSave(save, contentHash, content, sim.tables);
    expect(loaded).toEqual(world);
    // Ten days in, the first days are sealed; the remembered line stays as a stub.
    expect(world.segments.length).toBeGreaterThan(0);
    const memory = world.entities['keeper']![0]!['memory'] as number[];
    expect(recordOf(world, memory[0]!)).toMatchObject({ id: memory[0] });
    expect(world.log[0]!.id).toBeGreaterThan(memory[0]!);
    // Save, reload and continue gives the same ledger as an unbroken run (the P0.5 done-when).
    const unbroken = structuredClone(world);
    step(loaded, sim, 40320);
    step(unbroken, sim, 40320);
    expect(toNdjson(allLines(loaded))).toBe(toNdjson(allLines(unbroken)));
  });

  it('refuses a save from other content, another format or damaged', () => {
    const save = () => structuredClone(saveOf(world, contentHash));
    const check = (s: unknown) => () => checkSave(s, contentHash, content, sim.tables);
    expect(check({ ...save(), contentHash: 'other' })).toThrow(
      'different game content (other in the save',
    );
    expect(check({ ...save(), version: 0 })).toThrow('save format 0');
    expect(check('{}')).toThrow('damaged');
    // A map or ledger broken inside a well-formed record is caught too.
    const damage = [
      (s: SaveFile) => s.state.map.tiles.pop(),
      (s: SaveFile) => (s.state.map.tiles[5] = 99),
      (s: SaveFile) => s.state.map.chunkVersions.pop(),
      (s: SaveFile) => s.state.log.reverse(),
      (s: SaveFile) => s.state.stubs.push({ id: 1, tick: 0, type: 'world.begun' }),
      (s: SaveFile) => (s.state.stubs[0]!.type = 7 as unknown as string),
      // Entity tables are checked against their declared fields, whatever the kind.
      (s: SaveFile) => (s.state.entities['keeper']![0]!['age'] = -1),
      (s: SaveFile) => (s.state.entities['keeper']![1]!['holder'] = 99),
      (s: SaveFile) => (s.state.entities['keeper']![0]!['memory'] = [s.state.nextEventId]),
      (s: SaveFile) => (s.state.entities['keeper']![1]!['id'] = 1),
      (s: SaveFile) => (s.state.entities['stranger'] = []),
      (s: SaveFile) => (s.state.entities['keeper']![0]!['extra'] = 1),
      (s: SaveFile) => (s.state.nextEventId = 1),
      (s: SaveFile) => (s.state.map.biomes = new Uint8Array(3)),
      (s: SaveFile) => (s.state.map.features[0] = 250),
      (s: SaveFile) => (s.state.map.snow = new Uint8Array(3)),
      (s: SaveFile) => (s.state.map.startX = 1e6),
      (s: SaveFile) => s.state.map.levels.pop(),
      (s: SaveFile) => (s.state.map.rock = new Uint8Array(3)),
      (s: SaveFile) => (s.state.map.ice = new Uint8Array(3)),
      (s: SaveFile) => s.state.map.auraSpots.push({ ...s.state.map.auraSpots[0]!, school: 'none' }),
      // A level below one nobody has reached.
      (s: SaveFile) =>
        (s.state.map.levels[1] = {
          tiles: new Uint8Array(s.state.map.tiles.length),
          tileCauses: new Int32Array(s.state.map.tiles.length),
          features: new Uint8Array(s.state.map.tiles.length),
          chunkVersions: [...s.state.map.chunkVersions],
        }),
    ];
    for (const hurt of damage) {
      const bad = save();
      hurt(bad);
      expect(check(bad)).toThrow('damaged');
    }
  });

  // P1.3 done-when: a level not yet reached costs no memory. Structured-clone bytes (what
  // IndexedDB stores) are measured before and after stairs reach level 1.
  it('stores nothing for a level until it is reached', () => {
    const fresh = createWorld(sim, 'save-test');
    const bytes = () => serialize(saveOf(fresh, contentHash)).length;
    const before = bytes();
    expect(fresh.map.levels.every((level) => level === null)).toBe(true);
    const { startX: x, startY: y } = fresh.map;
    submitCommand(fresh, { tick: fresh.tick + 1, kind: 'cutStairs', data: { x, y, z: 0 } });
    step(fresh, sim, 1);
    const after = bytes();
    const level = fresh.map.levels[0]!;
    const own = level.tiles.byteLength + level.tileCauses.byteLength + level.features.byteLength;
    // The reached level adds its own arrays and little else (chunk versions, two ledger lines).
    expect(after - before).toBeGreaterThanOrEqual(own);
    expect(after - before).toBeLessThan(own + 4000);
    expect(
      checkSave(structuredClone(saveOf(fresh, contentHash)), contentHash, content, sim.tables),
    ).toEqual(fresh);
  });
});
