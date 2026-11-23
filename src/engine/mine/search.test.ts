// 6W Slice 7 (V-215): a vein below stays dark until a tunnel passes beside it. With a shaft at an
// ore's level and that ore wanted but no seam of it known, miners dig a search tunnel out from the
// shaft's foot, nobody ordering it; the vein shows only when the digging comes beside it.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { addEntity } from '../entity/index.ts';
import { chunkTiles, CHUNK } from '../map/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  step,
  submitCommand,
  withoutAccidents,
} from '../index.ts';
import { openVein } from './index.ts';

const content = withoutAccidents(game);
const sim = createSim(content);

describe('search tunnels', () => {
  it('keeps a vein dark until a search tunnel passes beside it, then shows it with a line', () => {
    const w = createWorld(sim, 'tallow');
    const map = w.map;
    const { startX: x, startY: y } = map;
    const send = (kind: string, data: Record<string, string | number>) =>
      submitCommand(w, { tick: w.tick + 1, kind, data });
    // A salt shaft sunk to level 2 at the green, as if dug before.
    send('sinkShaft', { x, y, z: 0, to: 2 });
    step(w, sim, 1);
    addEntity(w, 'shaft', {
      ...{ x, y, metal: 'salt', to: 2, state: 'done', depth: 2, sentBack: 0 },
      ...{ line: w.begunEvent, why: '' },
    });
    const level = map.levels[1]!;
    const copper = content.features.findIndex((f) => f.id === 'copper') + 1;
    level.features.forEach((f, i) => f === copper && (level.features[i] = 0));
    // Solid granite north of the foot, unknown, with copper 6 tiles up.
    const rock = content.terrain.kinds.findIndex((k) => k.id === 'rock-wall');
    for (let dy = 1; dy <= 12; dy += 1)
      for (let dx = -3; dx <= 3; dx += 1) {
        const i = (y - dy) * map.width + x + dx;
        [level.tiles[i], level.known[i]] = [rock, 0];
      }
    const vein = (y - 6) * map.width + x;
    level.features[vein] = copper;
    // The screen gets no vein while it is unknown.
    const chunk = () => chunkTiles(map, Math.floor(x / CHUNK), Math.floor((y - 6) / CHUNK), 2);
    const atChunk = (y - 6 - Math.floor((y - 6) / CHUNK) * CHUNK) * chunk().w + (x % CHUNK);
    expect(chunk().features[atChunk]).toBe(0);
    expect(openVein(w, content, 'copper')).toBe(false);
    send('setStock', { good: 'copper-ingot', level: 'some' });
    for (const q of w.entities['person'] ?? [])
      send('setPriority', { person: q.id, job: 'mine', level: 1 });
    const shown = () => allLines(w).find((l) => l.type === 'mine.veinShown');
    for (let h = 0; h < 20 * 24 && !shown(); h += 1) {
      step(w, sim, 60);
      // Dark until someone has dug beside it.
      if (!shown()) expect(level.known[vein]).toBe(0);
    }
    const begun = allLines(w).find((l) => l.type === 'mine.searchBegun')!;
    expect(begun.data).toMatchObject({ metal: 'copper', level: 2, from: 'the shaft foot' });
    expect(shown()!.data['metal']).toBe('copper');
    expect(level.known[vein]).toBe(1);
    expect(openVein(w, content, 'copper')).toBe(true);
    expect(chunk().features[atChunk]).toBe(copper);
  });
});
