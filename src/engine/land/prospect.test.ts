// 6W Slice 7 (V-215): ores show nothing on the ground. When iron is wanted and no seam of it is known, a
// prospector goes out unordered, the best free miner, walks the rock faces and may spot a seam in
// one; the line traces back to the want. Nobody is sent by name, to a tile or on a trip (V-041).
import { describe, expect, it } from 'vitest';
import { content as game, type Content } from '../../content/index.ts';
import { withoutAccidents } from '../health/index.ts';
import { allLines, createSim, createWorld, step, submitCommand, whyOf } from '../index.ts';

const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const IRON = game.features.findIndex((f) => f.id === 'iron') + 1;

/** Content with the spotting odds set to `per` (1 in `per` an hour at mining 0). */
const withOdds = (per: number): Content => {
  const c = withoutAccidents(game);
  const scout = { ...c.work.scout, prospect: { ...c.work.scout.prospect, per } };
  return { ...c, work: { ...c.work, scout } };
};

/** A colony that wants iron, the whole valley known; with `only`, every face but those over an
 * iron seam is already walked, so the prospector's first face is one with iron behind it. */
function wantsIron(content: Content, seed: string, only: boolean): World {
  const w = createWorld(createSim(content), seed);
  w.map.known.fill(1);
  if (only) w.map.faces.forEach((v, i) => v && v !== 1 + IRON && (w.map.faces[i] = v | 128));
  submitCommand(w, {
    tick: w.tick + 1,
    kind: 'setStock',
    data: { good: 'iron-ingot', level: 'some' },
  });
  return w;
}

const lines = (w: World, type: string) => allLines(w).filter((l) => l.type === type);

describe('prospecting', () => {
  it('has no lever that sends anyone by name, to a tile or on a trip (V-041)', () => {
    const sim = createSim(game);
    const kinds = sim.systems.flatMap((s) => Object.keys(s.commands ?? {}));
    expect(kinds.filter((k) => /prospect|seam|search|scout|trip/i.test(k))).toEqual([]);
    expect(kinds).toContain('sendBackShaft');
  });

  it('sends the best free miner to the faces, who spots a seam with a line tracing to the want', () => {
    const content = withOdds(2);
    const sim = createSim(content);
    const w = wantsIron(content, 'anvil', true);
    for (let t = 0; t < 8 * DAY && !lines(w, 'land.seamSpotted').length; t += 60) step(w, sim, 60);
    const spotted = lines(w, 'land.seamSpotted')[0]!;
    // Spotted on a prospecting trip, by the one who set out.
    const set = lines(w, 'work.tookUpProspecting').find((l) => spotted.causes.includes(l.id));
    expect(spotted.data['ore']).toBe('iron');
    expect(spotted.data['colour']).toBe('rust');
    expect(String(spotted.data['rock'])).toMatch(/^(granite|slate|limestone|sandstone)$/);
    // Who went is who spotted it, and the trip traces to a stock level (the iron the player set,
    // or the copper the colony's bronze asks for).
    expect(spotted.actors).toEqual(set!.actors);
    expect(whyOf(w, spotted.id).map((c) => c.event.type)).toContain('goods.stockSet');
    // The seam is a found place by its face, with that line; the mine plans a shaft beside it,
    // citing it.
    const seam = w.map.places.find((p) => p.what === 'iron')!;
    expect(seam.line).toBe(spotted.id);
    step(w, sim, 60);
    const planned = lines(w, 'mine.shaftPlanned')[0];
    expect(planned?.data['seam']).toBe('rust');
    expect(whyOf(w, planned!.id).map((c) => c.event.id)).toContain(spotted.id);
    // No command but the stock level was ever given.
    expect(lines(w, 'command.applied').map((l) => l.data['kind'])).toEqual(['setStock']);
  });

  it('sends nobody while every face within reach has been walked', () => {
    const content = withOdds(2);
    const sim = createSim(content);
    const w = wantsIron(content, 'smoke', false);
    w.map.faces.forEach((v, i) => v && (w.map.faces[i] = v | 128));
    step(w, sim, 3 * DAY);
    expect(lines(w, 'work.tookUpProspecting')).toHaveLength(0);
  });
});
