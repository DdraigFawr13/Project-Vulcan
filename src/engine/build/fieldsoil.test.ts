// Phase 5B Bundle 2 (V-130), fields: soil falls after a barley harvest and rises after beans; the
// rotation picks the next course and skips a missed window; a worn field rests and says so.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  emit,
  step,
  streamFor,
  templatesOf,
  type SystemContext,
  type WorldState,
} from '../index.ts';
import { courseNow, yieldAt } from './fieldsoil.ts';
import { cropNow, fieldsOf } from './fields.ts';
import { drawSoil, tickSoil } from './soillife.ts';

const DAY = 1440;
const sim = createSim(content);
const month = (name: string) => content.calendar.monthNames.indexOf(name);
const ctxOf = (w: WorldState): SystemContext => ({
  world: w,
  content,
  state: w.systems['build']!,
  rng: () => streamFor(w, 'build'),
  emit: (type, fields) => emit(w, templatesOf(content.events), type, fields),
});
/** A world a day old, so its first field is sited, and that field. */
function withField(seed: string) {
  const w = createWorld(sim, seed);
  step(w, sim, DAY);
  return { w, f: fieldsOf(w)[0]! };
}

describe('field soil', () => {
  it('falls after a barley harvest and rises after beans', () => {
    const { w, f } = withField('ledger');
    const tiles = f['tiles'] as number[];
    for (const i of tiles) w.map.fertility[i] = 60;
    drawSoil(ctxOf(w), f, 'barley', w.begunEvent);
    expect(tiles.every((i) => w.map.fertility[i] === 48)).toBe(true);
    drawSoil(ctxOf(w), f, 'beans', w.begunEvent);
    expect(tiles.every((i) => w.map.fertility[i] === 58)).toBe(true);
    const said = allLines(w).filter((e) => e.type === 'field.soil');
    expect(said.map((e) => e.data['what'])).toEqual([
      'fell after the barley',
      'rose after the beans',
    ]);
    expect(f['prev']).toBe('barley,beans');
  });

  it('scales a tile by its soil: full at 50, a fifth more at most', () => {
    const { w, f } = withField('ledger');
    const [a, b, c] = f['tiles'] as number[];
    Object.assign(w.map.fertility, { [a!]: 50, [b!]: 100, [c!]: 0 });
    expect(yieldAt(w, content, 100, a!)).toBe(100);
    expect(yieldAt(w, content, 100, b!)).toBe(120);
    expect(yieldAt(w, content, 100, c!)).toBe(50);
  });
});

describe('field rotation', () => {
  it('takes the next course and skips a missed window', () => {
    const { f } = withField('ledger');
    const crop = (course: number, m: string) => {
      f['course'] = course;
      return courseNow(content, f, m);
    };
    expect(crop(0, 'Thawmonth')?.crop.id).toBe('barley');
    // Barley's window is missed in Highsun: the next course (turnips) is sown instead.
    expect(crop(0, 'Highsun')).toMatchObject({ crop: { id: 'turnips' }, at: 1 });
    // Oats (course 4) missed in Highsun: beans (course 5), and the field then wraps to barley.
    expect(crop(4, 'Highsun')).toMatchObject({ crop: { id: 'beans' }, at: 5 });
    expect(crop(5, 'Thawmonth')).toMatchObject({ crop: { id: 'barley' }, at: 0 });
    // Two windows missed in a row: nothing this month.
    expect(crop(2, 'Thawmonth')).toBeUndefined();
  });

  it('rests a field whose soil is under the limit, saying so once', () => {
    const { w, f } = withField('ledger');
    w.tick = month('Thawmonth') * 28 * DAY + 400 * 28 * 12 * DAY;
    Object.assign(f, { course: 0, crop: '', done: [], state: 'fallow' });
    const tiles = f['tiles'] as number[];
    for (const i of tiles) w.map.fertility[i] = content.buildings.field.soil.rest + 1;
    expect(cropNow(w, content, f)?.id).toBe('barley');
    for (const i of tiles) w.map.fertility[i] = content.buildings.field.soil.rest - 1;
    expect(cropNow(w, content, f)).toBeUndefined();
    tickSoil(ctxOf(w), fieldsOf(w));
    w.systems['build']!['soilDay'] = 0;
    tickSoil(ctxOf(w), fieldsOf(w));
    expect(allLines(w).filter((e) => e.type === 'field.rests')).toHaveLength(1);
  });
});
