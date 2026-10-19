// Furniture and comfort as the page shows them: the pieces for the map, the bench's tile rows,
// a bed's owner, room and privacy, the feeds under Beauty and Privacy, and a carpenter's "doing".
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { benchOf, createSim, createWorld, furnitureOf, piecesOf, step } from '../engine/index.ts';
import { tileHouse } from './build.ts';
import { goodsOf, tileGoods } from './goods.ts';
import { walkersOf } from './people.ts';

const sim = createSim(content);
const DAY = 1440;
const nobody = () => ({}) as never;

describe('furniture views', () => {
  it('shows the bench and a bed in words, and what feeds beauty and privacy', () => {
    const world = createWorld(sim, 'ledger/1');
    const seen = new Set<string>();
    let bed: ReturnType<typeof piecesOf>[number] | undefined;
    for (let day = 0; day < 20 && !(bed && bed['owner']); day += 1) {
      step(world, sim, DAY / 2);
      for (const w of walkersOf(world)) seen.add(w.now.text);
      bed = piecesOf(world, 'bed')[0];
    }
    const bench = benchOf(world)!;
    expect(bench).toBeDefined();
    const art = goodsOf(world).furniture;
    expect(art.map((f) => f.art)).toContain('furn.bench');
    expect(art.length).toBe(furnitureOf(world).length);

    const at = tileGoods(world, bench['x'] as number, bench['y'] as number, 0, nobody).piece!;
    expect(at.state).toBe('built');
    expect(at.quality).toMatch(/, made by /);
    expect(at.bench?.next).toMatch(/^(nobody makes furniture now|nothing; |.+: the .+)/);
    expect(at.bench?.making).toBeTruthy();

    expect(bed).toBeDefined();
    const x = bed!['x'] as number;
    const y = bed!['y'] as number;
    const piece = tileGoods(world, x, y, 0, nobody).piece!;
    expect(piece.name).toBe('bed');
    expect(piece.rest).toContain('faster than a bedroll');
    expect(piece.privacy).toMatch(/sleep/);
    const room = tileHouse(world, x, y, nobody).room!;
    if (bed!['owner'] && /alone/.test(piece.privacy!)) expect(room.name).toMatch(/'s bedroom$/);
    expect(piece.owner).toMatch(/'s bed$|nobody yet/);

    // Beauty and privacy rows carry a word for what feeds them; the others do not.
    for (const w of walkersOf(world)) {
      expect(w.needs.find((n) => n.name === 'Beauty')?.feeds).toBeTruthy();
      expect(w.needs.find((n) => n.name === 'Privacy')?.feeds).toBeTruthy();
      expect(w.needs.find((n) => n.name === 'Food')?.feeds).toBeUndefined();
    }
    // A carpenter at work reads in the work.json words, never "hauling".
    expect([...seen].some((t) => /^Making /.test(t))).toBe(true);
    expect([...seen].some((t) => /\{/.test(t))).toBe(false);
  });
});
