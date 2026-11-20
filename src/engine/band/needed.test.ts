// Seen at work Part 2 (V-195, V-041): a pick is needed to mine. With none in the valley nobody
// takes up mining, one line says what it waits on and the Work row says so; a pick knapped by
// someone with crafting skill, unordered, starts it again.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { allLines, createSim, createWorld, itemsOf, step } from '../index.ts';
import { withoutAccidents } from '../index.ts';
import { toolOf } from '../goods/index.ts';
import { toolWaits } from './knap.ts';

const content = withoutAccidents(game);
const sim = createSim(content);
// Nobody can knap: a stone tool would take an iron ingot, and none is had.
const noKnap = createSim({
  ...content,
  tools: {
    ...content.tools,
    knap: { ...content.tools.knap, from: { 'iron-ingot': 1 }, loose: [] },
  },
});
const HOUR = 60;
type World = ReturnType<typeof createWorld>;
const people = (w: World) => w.entities['person'] ?? [];
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** A valley with no pick, on a seed whose worn tools soon ask for bronze, so miners would sink a
 * shaft (V-100). */
function noPick(knappers: boolean): World {
  const w = createWorld(knappers ? sim : noKnap, 'smoke');
  w.entities['item'] = itemsOf(w).filter((i) => toolOf(content, i)?.kind !== 'pick');
  return w;
}

/** Steps hour by hour for `hours`, noting whether anyone was at mining work. */
function mined(w: World, hours: number, on = sim): boolean {
  let any = false;
  for (let h = 0; h < hours; h += 1) {
    step(w, on, HOUR);
    if (people(w).some((p) => p['job'] === 'mine')) any = true;
  }
  return any;
}

describe('a needed pick', () => {
  it('stops mining with none in the valley: one waiting line, and the Work row says why', () => {
    const w = noPick(false);
    expect(mined(w, 6 * 24, noKnap)).toBe(false);
    expect(lines(w, 'tool.none').filter((l) => l.data['kind'] === 'pick')).toHaveLength(1);
    expect(toolWaits(w, content, 'mine')).toBe('no pick in the valley');
    expect(lines(w, 'tool.knapped')).toHaveLength(0);
    expect(w.commandLog).toHaveLength(0);
  });

  it('starts mining again with a pick knapped, unordered, by someone with crafting skill', () => {
    const w = noPick(true);
    expect(mined(w, 6 * 24)).toBe(true);
    const knapped = lines(w, 'tool.knapped').find((l) => String(l.data['what']).includes('pick'));
    expect(knapped).toBeDefined();
    const took = lines(w, 'work.tookUp').filter((l) => l.tick > knapped!.tick);
    expect(took.length).toBeGreaterThan(0);
    expect(toolWaits(w, content, 'mine')).not.toBe('no pick in the valley');
  });
});
