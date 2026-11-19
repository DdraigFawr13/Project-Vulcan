// Hand-me-down tools (Phase 4 review): at the hour work starts for each, every holder whose tool
// is beaten by a free one takes the best, and the old one goes to whoever holds the worst of the
// kind (writing a line citing the taking), not back to the cart; a worn tool asks for ingots only
// of someone who still does that work.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, itemsOf, step } from '../index.ts';
import { addEntity } from '../entity/index.ts';
import {
  freeTools,
  heldBy,
  HELD,
  layTool,
  restOf,
  toolOf,
  toolsChanged,
  wornTools,
} from '../goods/index.ts';

const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const people = (w: World) => w.entities['person'] ?? [];
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const kindOf = (item: { [k: string]: unknown }) => toolOf(content, item as never)!.kind;

/** Makes `item` the held tool of `person`. */
function hand(item: { [k: string]: unknown }, person: number): void {
  Object.assign(item, { owner: person, state: 'held', ...HELD });
}

/** Every free tool of a kind is removed, so only those handed out exist. */
function clearFree(w: World, kind: string): void {
  for (const t of freeTools(w, content, kind))
    w.entities['item'] = itemsOf(w).filter((i) => i.id !== t.id);
}

describe('hand-me-down tools', () => {
  it('hands worn axes down: two holders both end on better axes, the old one to the worst', () => {
    const w = createWorld(sim, 'ledger');
    const [a, b, c] = people(w);
    const unloaded = lines(w, 'goods.unloaded')[0]!.id;
    clearFree(w, 'axe');
    const stone = (who: number, wear: number) => {
      const t = layTool(w, content, restOf(w, content), {
        ...{ kind: 'axe', material: 'stone', quality: 'plain', made: unloaded },
      });
      hand(t, who);
      t['wear'] = wear;
      return t;
    };
    const [sa, sb, sc] = [stone(a!.id, 2000), stone(b!.id, 1300), stone(c!.id, 1000)];
    for (const p of people(w).slice(3)) stone(p.id, 3600);
    const bronze = [1, 2].map(() =>
      layTool(w, content, restOf(w, content), {
        ...{ kind: 'axe', material: 'bronze', quality: 'plain', made: unloaded },
      }),
    );
    for (const [who, minutes] of [
      [a!, 9000],
      [b!, 8000],
      [c!, 7000],
    ] as const)
      addEntity(w, 'usage', { person: who.id, kind: 'axe', minutes });
    step(w, sim, 2 * DAY);
    const held = (who: number) =>
      heldBy(w, content, who)
        .filter((t) => kindOf(t) === 'axe')
        .map((t) => t.id);
    expect(bronze.map((t) => t['owner'])).toEqual([a!.id, b!.id]);
    // a's old axe went to c, whose axe was the worst; b's was no better than c's new one.
    expect(sa['owner']).toBe(c!.id);
    expect(held(c!.id)).toEqual([sa.id]);
    const free = freeTools(w, content, 'axe').map((t) => t.id);
    expect(free).toEqual(expect.arrayContaining([sb.id, sc.id]));
    const taken = lines(w, 'tool.taken').find(
      (e) => e.actors[0] === a!.id && e.data['what'] === 'a bronze axe',
    )!;
    const down = lines(w, 'tool.handedDown')[0]!;
    expect(down.actors).toEqual([a!.id, c!.id]);
    expect(down.causes).toEqual([taken.id]);
    expect(down.data['why']).toContain('was worn');
  });

  it('asks for no ingots for a worn tool whose holder no longer does that work', () => {
    const w = createWorld(sim, 'ledger');
    const [a] = people(w);
    const unloaded = lines(w, 'goods.unloaded')[0]!.id;
    clearFree(w, 'axe');
    const t = layTool(w, content, restOf(w, content), {
      ...{ kind: 'axe', material: 'stone', quality: 'plain', made: unloaded },
    });
    hand(t, a!.id);
    t['wear'] = 10;
    expect(wornTools(w, content)).toHaveLength(0);
    addEntity(w, 'usage', { person: a!.id, kind: 'axe', minutes: 5 });
    toolsChanged(w);
    expect(wornTools(w, content)).toHaveLength(1);
  });
});
