// P3.4 and P3.5 done-whens: furniture quality follows the carpenter's skill; with no order given
// the colony sets up a bench, makes beds and everyone ends up in a bed they own; a colonist alone
// in an owned bedroom ends a week in a better mood than one in the barracks; every lever stays
// indirect (V-041).
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  bedOwnedBy,
  createSim,
  allLines,
  createWorld,
  furnitureOf,
  moodOf,
  needOf,
  piecesOf,
  qualityOf,
  roomAt,
  roomsOf,
  step,
  submitCommand,
  SYSTEMS,
  whyOf,
} from '../index.ts';
import { HEARTH, siteFor } from './index.ts';

const sim = createSim(content);
const DAY = 1440;
const SEEDS = ['ledger', 'tallow', 'anvil'];
type World = ReturnType<typeof createWorld>;
const people = (w: World) => w.entities['person'] ?? [];

/** A world whose band all have crafting level `level`, which cannot rise (potential the same). */
function crafters(seed: string, level: number): World {
  const w = createWorld(sim, seed);
  for (const s of w.entities['skill'] ?? [])
    if (s['skill'] === 'crafting') Object.assign(s, { level, potential: level });
  return w;
}

/** The first piece made (lowest `made` line). */
const firstMade = (w: World) =>
  piecesOf(w)
    .filter((f) => f['kind'] !== 'hearth')
    .reduce((a, b) => ((a['made'] as number) < (b['made'] as number) ? a : b));

describe('carpentry and furniture', () => {
  it('makes better furniture the better the carpenter (same seed, same first roll)', () => {
    const [low, high] = [crafters('ledger', 2), crafters('ledger', 8)];
    step(low, sim, 4 * DAY);
    step(high, sim, 4 * DAY);
    const [a, b] = [firstMade(low), firstMade(high)];
    // The bench comes first, and it is the same draw of the craft stream in both worlds.
    expect([a['kind'], b['kind']]).toEqual(['bench', 'bench']);
    expect((b['quality'] as number) - (a['quality'] as number)).toBe(6);
    const beauty = (f: typeof a) => qualityOf(content, f['quality'] as number).beauty;
    expect(beauty(b)).toBeGreaterThan(beauty(a));
    // The line names the maker and quality, and cites the bench's being set up.
    const line = allLines(high).find((e) => e.id === b['made'])!;
    expect(line.data['name']).toBe(people(high).find((p) => p.id === b['maker'])!['name']);
    expect(whyOf(high, line.id).map((c) => c.event.type)).toContain('furniture.benchPlaced');
  });

  for (const seed of SEEDS) {
    it(`sets up a bench, makes beds and puts everyone in a bed they own, unordered, on ${seed}`, () => {
      const w = createWorld(sim, seed);
      step(w, sim, 9 * DAY + 16 * 60);
      expect(w.commandLog).toHaveLength(0);
      expect(allLines(w).filter((e) => e.type === 'furniture.benchPlaced')).toHaveLength(1);
      expect(piecesOf(w, 'bench')).toHaveLength(1);
      const beds = piecesOf(w, 'bed');
      const owned = beds.filter((b) => b['owner']);
      expect(owned).toHaveLength(Math.min(people(w).length, beds.length));
      expect(new Set(owned.map((b) => b['owner'])).size).toBe(owned.length);
      // The bench, then a bed, are the first things made; at night everyone
      // sleeps in their own bed.
      const took = allLines(w)
        .filter((e) => e.type === 'work.tookUpCarpentry')
        .map((e) => e.data['kind']);
      expect(took.slice(0, 2)).toEqual(['bench', 'bed']);
      // Through the night each is seen asleep on their own bed (some are up for a bite).
      const slept = new Set<number>();
      for (let h = 0; h < 8; h += 1) {
        step(w, sim, 60);
        for (const p of people(w)) {
          const bed = bedOwnedBy(w, p.id)!;
          if (p['doing'] === 'sleep' && p['x'] === bed['x'] && p['y'] === bed['y']) slept.add(p.id);
        }
      }
      expect([...slept].sort()).toEqual(people(w).map((p) => p.id));
      for (const p of people(w)) {
        const bed = bedOwnedBy(w, p.id)!;
        // Their latest bed line: the claim, or a move to a room of their own (V-078), which
        // cites the bed and the low privacy behind it.
        const claim = allLines(w)
          .filter(
            (e) =>
              (e.type === 'people.claimedBed' || e.type === 'people.movedRoom') &&
              e.actors[0] === p.id,
          )
          .at(-1)!;
        if (claim.type === 'people.claimedBed') expect(claim.causes).toEqual([bed['made']]);
        else expect(claim.causes[0]).toBe(bed['made']);
      }
      // Rooms count the pieces: beds, and the quality words' beauty. A room left with a spare bed
      // when its sleeper moved for privacy (V-078) has more beds than sleepers, so take the room
      // of the first bed whose every bed is owned.
      const full = owned
        .map((b) => roomAt(w, content, b['x'] as number, b['y'] as number)!)
        .find((r) =>
          beds
            .filter((b) => r.tiles.includes((b['y'] as number) * w.map.width + (b['x'] as number)))
            .every((b) => b['owner']),
        )!;
      expect(full).toBeDefined();
      expect(full.bedPieces).toBeGreaterThan(0);
      expect(full.sleepers).toBe(full.bedPieces);
      // Every piece stands on a floor tile of a room, never on its way in.
      for (const f of furnitureOf(w)) {
        const r = roomAt(w, content, f['x'] as number, f['y'] as number);
        // The campfire on the green is the one piece outside a room.
        if (!r) {
          expect(f['kind']).toBe('hearth');
          continue;
        }
        expect(
          r.doorTiles.flatMap((d) => [d - 1, d + 1, d - w.map.width, d + w.map.width]),
        ).not.toContain((f['y'] as number) * w.map.width + (f['x'] as number));
      }
      // Furnished in summer, every room still has a tile for a hearth when the cold comes (the
      // phase review found rooms full by day 3 and nobody warm indoors all winter).
      for (const rr of roomsOf(w, content)) expect(siteFor(w, content, rr, HEARTH)).toBeDefined();
    });
  }

  // Seeds where a barracks lasts the week: on tallow privacy rooms (V-078) empty it, as they should.
  for (const seed of ['ledger', 'anvil', 'gwerin']) {
    it(`lets a colonist alone in an owned bedroom end a week in a better mood than the barracks on ${seed}`, () => {
      const w = createWorld(sim, seed);
      step(w, sim, 10 * DAY);
      const roomOf = (p: (typeof w.entities)['person'][number]) => {
        const bed = bedOwnedBy(w, p.id)!;
        return roomAt(w, content, bed['x'] as number, bed['y'] as number)!;
      };
      const alone = people(w).filter((p) => roomOf(p).sleepers === 1);
      const shared = people(w).filter((p) => roomOf(p).sleepers >= 3);
      // Each sleeps alone or in a barracks of three or more; how many of each is the seed's
      // layout (one alone on ledger and anvil, two on tallow).
      expect(alone.length, seed).toBeGreaterThanOrEqual(1);
      expect(shared.length, seed).toBeGreaterThanOrEqual(3);
      expect(alone.length + shared.length, seed).toBe(people(w).length);
      step(w, sim, 7 * DAY);
      // A barracks sleeper may move to a room of their own during the week (V-078): compare
      // those still sharing with those alone all week.
      const still = shared.filter((p) => roomOf(p).sleepers >= 3);
      expect(still.length, seed).toBeGreaterThanOrEqual(1);
      const mood = (p: (typeof alone)[number]) => moodOf(w, p.id)!['value'] as number;
      const mean = still.reduce((n, p) => n + mood(p), 0) / still.length;
      const most = Math.max(...still.map((p) => needOf(w, p.id, 'privacy')!['value'] as number));
      for (const p of alone) {
        expect(mood(p), seed).toBeGreaterThan(mean);
        expect(needOf(w, p.id, 'privacy')!['value'], seed).toBeGreaterThan(most);
      }
    });
  }

  it('keeps carpentry an indirect lever: a Work sheet row after Building, no command to place or assign', () => {
    const levers = ['setStock', 'setPriority', 'setDay', 'setBuild', 'sendBack'];
    const tools = [
      'placeBuilding',
      'deconstruct',
      'cutStairs',
      'sinkShaft',
      'markFell',
      'markStore',
    ];
    const kinds = SYSTEMS.flatMap((s) => Object.keys(s.commands ?? {}));
    expect(kinds.filter((k) => !levers.includes(k) && !tools.includes(k))).toEqual([]);
    const jobs = content.work.priority.jobs;
    expect(jobs.indexOf('carpentry')).toBe(jobs.indexOf('build') + 1);
    // Raising one colonist's Carpentry gets them making furniture, their taking-up citing it.
    const w = createWorld(sim, 'tallow');
    const pick = people(w)[2]!;
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setPriority',
      data: { person: pick.id, job: 'carpentry', level: 1 },
    });
    step(w, sim, 6 * DAY);
    const mine = allLines(w).find(
      (e) => e.type === 'work.tookUpCarpentry' && e.actors[0] === pick.id,
    )!;
    expect(mine).toBeDefined();
    expect(whyOf(w, mine.id).map((c) => c.event.type)).toContain('work.prioritySet');
  });
});
