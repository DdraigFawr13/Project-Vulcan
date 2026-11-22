// P6.7 done-when (V-160): every defiance line cites a memory and a belief, in a test over a hard
// winter. A fresh band is set down at the first day of winter with nothing put by, under Hunger
// rations; as the grievance holds, people climb the ladder one step at a time: working slowly,
// pocketing from the store (caught by whoever sees), coming to blows. Each act's line cites the
// answer, the memory and the belief behind it, and the belief walks back to a full plate seen.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  findEvent,
  isWinter,
  step,
  submitCommand,
  TICKS_PER_DAY,
  type SimEvent,
} from '../index.ts';

const sim = createSim(content);
type World = ReturnType<typeof createWorld>;
const ACTS = ['defy.slow', 'defy.took', 'defy.brawled', 'defy.left'];

/** A band set down on the first morning of winter under Hunger rations, run `days` days;
 * `each` looks at the world after every day. */
function hardWinter(seed: string, days: number, each: (w: World) => void): World {
  const w = createWorld(sim, seed);
  // The whole valley known (V-205): this winter's work, and so its quarrels, stay near the green.
  w.map.known.fill(1);
  let day = 0;
  while (!isWinter({ ...w, tick: day * TICKS_PER_DAY }, content)) day += 1;
  w.tick = day * TICKS_PER_DAY + 6 * 60;
  step(w, sim, 60);
  submitCommand(w, {
    tick: w.tick + 1,
    kind: 'setLaw',
    data: { law: 'rations', setting: 'hunger' },
  });
  for (let d = 0; d < days; d += 1) {
    step(w, sim, TICKS_PER_DAY);
    each(w);
  }
  return w;
}

/** The chain of causes behind line `e`, back to the start. */
function chain(w: World, e: SimEvent): SimEvent[] {
  const out: SimEvent[] = [];
  const todo = [...e.causes];
  const seen = new Set<number>();
  while (todo.length) {
    const id = todo.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const c = findEvent(allLines(w), id);
    if (!c) continue;
    out.push(c);
    todo.push(...c.causes);
  }
  return out;
}

describe('defiance (P6.7)', () => {
  // Each thief caught, and whether those who caught them hold it in mind that day.
  const remembered: boolean[] = [];
  let looked = 0;
  const w = hardWinter('anvil', 40, (x) => {
    const fresh = allLines(x).filter((e) => e.id > looked && e.type === 'defy.caught');
    looked = allLines(x).at(-1)?.id ?? looked;
    for (const c of fresh.filter((e) => e.data['act'] === 'took')) {
      const [thief, ...saw] = c.actors;
      remembered.push(
        saw.every((q) =>
          (x.entities['memory'] ?? []).some(
            // Held of this thief, or refreshed since by a later theft seen the same day.
            (m) =>
              m['person'] === q &&
              m['memory'] === 'saw-theft' &&
              (m['about'] === thief || (m['line'] as number) > c.id),
          ),
        ),
      );
    }
  });
  const all = allLines(w);
  const acts = all.filter((e) => ACTS.includes(e.type));

  it('climbs the ladder over a hard winter: works slowly, takes from the store, brawls', () => {
    const kinds = new Set(acts.map((e) => e.type));
    expect(kinds).toContain('defy.slow');
    expect(kinds).toContain('defy.took');
    expect(kinds).toContain('defy.brawled');
  });

  it('cites a memory and a belief on every act', () => {
    const memories = content.memories.map((m) => m.text.toLowerCase().split('{about}')[0]!);
    const beliefs = content.tales.beliefs.map((b) => b.text);
    for (const e of acts) {
      const types = e.causes.map((c) => findEvent(all, c)?.type);
      expect(types, e.type).toContain('law.answered');
      expect(e.causes.length, e.type).toBe(3);
      const [mem, belief] = (e.data['why'] as string).split('; ');
      expect(
        memories.some((m) => mem!.startsWith(m.trim())),
        mem,
      ).toBe(true);
      expect(
        beliefs.some((b) => belief!.endsWith(b)),
        belief,
      ).toBe(true);
    }
  });

  it('walks each act back through its belief to a full plate seen or told', () => {
    for (const e of acts) {
      const back = chain(w, e).map((c) => c.type);
      expect(back, e.type).toContain('law.keptCustom');
    }
  });

  it('catches a thief someone sees, and they remember it', () => {
    expect(remembered.length).toBeGreaterThan(0);
    expect(remembered.every(Boolean)).toBe(true);
  });
});
