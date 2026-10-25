// Phase 5B Bundle 2 (V-130), blight and dry spells: a wet spell blights a sown field and the line
// names the wet days; blighted tiles yield nothing; an unwatered far tile loses yield in a dry
// spell and a watered one does not.
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
import { farFromWater, tickBlight, tileYield } from './blight.ts';
import { fieldsOf } from './fields.ts';

const DAY = 1440;
const sim = createSim(content);
const ctxOf = (w: WorldState): SystemContext => ({
  world: w,
  content,
  state: w.systems['build']!,
  rng: () => streamFor(w, 'build'),
  emit: (type, fields) => emit(w, templatesOf(content.events), type, fields),
});
/** A world a day old, so its first field is sited, with that field sown to barley just now. */
function sown(seed: string) {
  const w = createWorld(sim, seed);
  step(w, sim, DAY);
  const f = fieldsOf(w)[0]!;
  const resow = () =>
    Object.assign(f, { state: 'sown', crop: 'barley', sown: w.tick, blight: [], cut: 0 });
  resow();
  f['dry'] = (f['tiles'] as number[]).map(() => 0);
  return { w, f, resow };
}
/** Days pass, each with weather of kind `kind` (wet or not), until `done` or `days` have gone. */
function pass(w: WorldState, kind: string, days: number, each: () => void, done = () => false) {
  const weather = w.systems['weather']!;
  weather['kind'] = content.weather.findIndex((k) => k.id === kind);
  weather['wet'] = kind === 'wet' ? 1 : 0;
  for (let d = 0; d < days && !done(); d += 1) {
    w.tick += DAY;
    each();
    tickBlight(ctxOf(w), fieldsOf(w));
  }
}

describe('blight', () => {
  it('starts in a wet spell and its line names the wet days', () => {
    const { w, f, resow } = sown('ledger');
    pass(w, 'wet', 400, resow, () => (f['blight'] as number[]).length > 0);
    expect((f['blight'] as number[]).length).toBe(1);
    const line = allLines(w).find((e) => e.type === 'field.blight')!;
    expect(line.data['wet']).toBe(14);
    expect(line.data['crop']).toBe('barley');
    expect(line.data['again']).toBe('');
    expect(allLines(w).filter((e) => e.type === 'field.blight')).toHaveLength(1);
  });

  it('says so when the crop grew on the field last year', () => {
    const { w, f, resow } = sown('ledger');
    f['prev'] = 'oats,barley';
    pass(w, 'wet', 400, resow, () => (f['blight'] as number[]).length > 0);
    const line = allLines(w).find((e) => e.type === 'field.blight')!;
    expect(line.data['again']).toContain('grew there last year');
  });

  it('does not start in a dry spell', () => {
    const { w, f, resow } = sown('ledger');
    pass(w, 'dry', 200, resow);
    expect(f['blight'] as number[]).toHaveLength(0);
  });

  it('leaves blighted tiles with no yield', () => {
    const { w, f } = sown('ledger');
    const [sick, well] = f['tiles'] as number[] as [number, number];
    f['blight'] = [sick];
    expect(tileYield(w, content, f, 100, sick)).toBe(0);
    expect(tileYield(w, content, f, 100, well)).toBeGreaterThan(0);
  });
});

describe('dry spells', () => {
  it('cost an unwatered far tile yield and a watered one none', () => {
    for (const seed of ['ledger', 'harbor', 'lantern', 'orchard', 'quarry', 'meadow']) {
      const { w, f, resow } = sown(seed);
      const far = (f['tiles'] as number[]).filter((i) => farFromWater(w, content, i));
      if (far.length < 2) continue;
      const [parched, watered] = far as [number, number];
      const before = tileYield(w, content, f, 100, parched);
      // Five dry days after the first (which only starts the count) cost 1% each; one tile is watered daily.
      pass(w, 'dry', 6, () => {
        resow();
        f['watered'] = [watered];
      });
      expect(tileYield(w, content, f, 100, parched)).toBeLessThan(before);
      expect(tileYield(w, content, f, 100, watered)).toBe(before);
      return;
    }
    throw new Error('no seed gave a field with two tiles far from water');
  });
});
