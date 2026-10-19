// Bundle 3 (V-041, V-049): the smithy. Once an ingot is in the store the colony plans a smithy on
// the best smith's house, on its side nearest water, with a reason; the plan can be sent back
// once; builders raise it and the smith's forge stands. The Smithy row is a Build level.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  allLines,
  bedOwnedBy,
  createSim,
  createWorld,
  step,
  storeOf,
  submitCommand,
} from '../index.ts';
import { layItem } from '../goods/index.ts';
import { houseAt, housesOf, mainOf, piecesOf, smithiesOf } from './index.ts';

const sim = createSim(content);
const DAY = 1440;
const SEEDS = ['ledger', 'tallow', 'anvil', 'ledger/1', 'tallow/2', 'smoke/1'];
type World = ReturnType<typeof createWorld>;
const people = (w: World) => w.entities['person'] ?? [];
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** Worlds ten days on, one per seed, with a built house and someone sleeping in a bed of it. */
function* housedWorlds(): Generator<World> {
  for (const seed of SEEDS) {
    const w = createWorld(sim, seed);
    step(w, sim, 10 * DAY);
    if (
      housesOf(w).some((h) => h['state'] === 'built') &&
      people(w).some((p) => bedOwnedBy(w, p.id))
    )
      yield w;
  }
}

/** Makes `person` the best smith (the others are at 0) and lays an ingot in the store. */
function ingotFor(w: World, person: number, kind: string): void {
  for (const s of w.entities['skill'] ?? [])
    if (s['skill'] === 'smithing')
      Object.assign(s, { level: s['person'] === person ? 9 : 0, potential: 20 });
  const at = storeOf(w)[0]!;
  const spot = { x: at['x'] as number, y: at['y'] as number, z: 0 };
  layItem(w, { kind, count: 1, ...spot, made: 1 });
}

/** Whether water lies at exactly Chebyshev distance `r` from (cx, cy). */
function wetAt(w: World, cx: number, cy: number, r: number): boolean {
  for (let y = cy - r; y <= cy + r; y += 1)
    for (let x = cx - r; x <= cx + r; x += 1)
      if (
        Math.max(Math.abs(x - cx), Math.abs(y - cy)) === r &&
        content.terrain.kinds[w.map.tiles[y * w.map.width + x]!]!.water
      )
        return true;
  return false;
}

describe('the smithy', () => {
  it("is sited on the best smith's house, nearest water, with a reason and one send-back", () => {
    let replaced = false;
    for (const w of housedWorlds()) {
      expect(lines(w, 'smithy.sited')).toHaveLength(0);
      const smith = people(w).find((p) => bedOwnedBy(w, p.id))!;
      ingotFor(w, smith.id, 'iron-ingot');
      const commands = w.commandLog.length;
      step(w, sim, 60);
      expect(w.commandLog).toHaveLength(commands);
      const sited = lines(w, 'smithy.sited')[0]!;
      const s = smithiesOf(w)[0]!;
      // Crowded round by rooms and trees, a house has no side that fits: one alert, next seed.
      if (!sited) {
        expect(lines(w, 'smithy.noGround')).toHaveLength(1);
        continue;
      }
      // It shares a wall with the house the best smith sleeps in.
      const bed = bedOwnedBy(w, smith.id)!;
      const home = mainOf(w, houseAt(w, bed['x'] as number, bed['y'] as number)!);
      expect(s['house']).toBe(home.id);
      expect(String(s['why'])).toContain(
        `${smith['name'] as string} is the best smith (smithing 9)`,
      );
      expect(sited.data['why']).toBe(s['why']);
      // The water it names is that far off, and nearer water is not.
      const d = Number(/is (\d+) tiles? off/.exec(String(s['why']))?.[1]);
      expect(d).toBeGreaterThan(0);
      const cx = (s['x'] as number) + Math.floor((s['w'] as number) / 2);
      const cy = (s['y'] as number) + Math.floor((s['h'] as number) / 2);
      expect(wetAt(w, cx, cy, d)).toBe(true);
      for (let r = 1; r < d; r += 1) expect(wetAt(w, cx, cy, r)).toBe(false);
      // A forge, an anvil block and a tub are planned with it.
      const kinds = ['forge', 'anvil', 'tub'];
      const planned = (w.entities['furniture'] ?? []).filter((f) =>
        kinds.includes(f['kind'] as string),
      );
      expect(planned).toHaveLength(3);

      // One send-back: the colony chooses again, the replacement cannot be sent back.
      submitCommand(w, { tick: w.tick + 1, kind: 'sendBack', data: { smithy: s.id } });
      step(w, sim, 5);
      expect(lines(w, 'smithy.sentBack')).toHaveLength(1);
      expect(s['state']).toBe('sent');
      const again = smithiesOf(w).find((r) => r['state'] === 'plan');
      // A cramped house may have only the one side that fits: the next seed is tried.
      if (!again) continue;
      replaced = true;
      expect(again['sent']).toBe(1);
      const apart =
        (again['x'] as number) >= (s['x'] as number) + (s['w'] as number) ||
        (s['x'] as number) >= (again['x'] as number) + (again['w'] as number) ||
        (again['y'] as number) >= (s['y'] as number) + (s['h'] as number) ||
        (s['y'] as number) >= (again['y'] as number) + (again['h'] as number);
      expect(apart).toBe(true);
      submitCommand(w, { tick: w.tick + 1, kind: 'sendBack', data: { smithy: again.id } });
      step(w, sim, 5);
      expect(lines(w, 'smithy.sentBack')).toHaveLength(1);
      const refused = lines(w, 'command.refused').map((e) => e.data['reason']);
      expect(refused).toContain('it was sent back once already');
      break;
    }
    expect(replaced).toBe(true);
  });

  it('is raised by builders, forge, anvil block and tub, with no one told', () => {
    const w = housedWorlds().next().value!;
    ingotFor(w, people(w).find((p) => bedOwnedBy(w, p.id))!.id, 'copper-ingot');
    step(w, sim, 12 * DAY);
    const s = smithiesOf(w)[0]!;
    expect(s['state']).toBe('built');
    const stations = piecesOf(w).filter((f) =>
      ['forge', 'anvil', 'tub'].includes(f['kind'] as string),
    );
    expect(stations).toHaveLength(3);
    // The sited line is the smithy's own record, and the built line cites what finished it.
    expect(lines(w, 'smithy.sited')[0]!.id).toBe(s['line']);
    expect(lines(w, 'smithy.built')[0]!.causes.length).toBeGreaterThan(0);
  });

  it('has a Build level that takes the lever', () => {
    const w = createWorld(sim, 'ledger');
    submitCommand(w, { tick: w.tick + 1, kind: 'setBuild', data: { kind: 'smithy', level: 4 } });
    step(w, sim, 2);
    expect(lines(w, 'build.wantSet').map((e) => e.data['kind'])).toContain('Smithy');
  });
});
