// The wild valley's words for the page (Phase 5A Bundle 2): a herd's page and the pack's page, a
// tile's prints and snow, the animals sent only when one moves, and the leftovers count.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { animalsOf, createSim, createWorld, packOf, herdsOf } from '../engine/index.ts';
import { tileView } from './views.ts';
import { animalFeed, animalPage, leftoversView } from './wild.ts';

const sim = createSim(content);
const nobody = () => ({ text: '' }) as never;

describe('the wild valley on the page', () => {
  const w = createWorld(sim, 'anvil/1');

  it('opens a herd page from a game animal, with the spare rule', () => {
    const deer = animalsOf(w).find((a) => a['herd'] && a['kind'] === 'hind')!;
    const page = animalPage(w, deer.id, nobody)!;
    expect(page.title).toBe('Red deer');
    expect(page.who).toMatch(/^A herd of \d+ .+, \d+ tiles? .+ of the green$/);
    const rows = Object.fromEntries(page.rows);
    expect(rows['Spared']).toBe(`hunters leave its last ${content.wild.spare}`);
    expect(rows['Herd']).toMatch(/hind/);
    expect(rows['Taken this year']).toBe('none yet');
  });

  it('opens the pack page from a wolf, hunger in words, and hunted-by only after an attack', () => {
    const wolf = animalsOf(w).find((a) => !a['herd'])!;
    const page = animalPage(w, wolf.id, nobody)!;
    const rows = Object.fromEntries(page.rows);
    expect(page.who).toMatch(/^One of /);
    expect(rows['Hunger']).toBe('fed');
    expect(rows['Hunted by']).toBeUndefined();
    packOf(w)!['hunger'] = content.wild.pack.hungry;
    expect(Object.fromEntries(animalPage(w, wolf.id, nobody)!.rows)['Hunger']).toBe('hungry');
    packOf(w)!['hunger'] = content.wild.pack.visit;
    expect(Object.fromEntries(animalPage(w, wolf.id, nobody)!.rows)['Hunger']).toBe('starving');
    expect(animalPage(w, 99999, nobody)).toBeUndefined();
  });

  it('sends the animals only when one has moved', () => {
    const feed = animalFeed();
    expect(feed.next(w)?.length).toBe(animalsOf(w).length);
    expect(feed.next(w)).toBeUndefined();
    const first = animalsOf(w)[0]!;
    first['x'] = (first['x'] as number) + 1;
    expect(feed.next(w)).toBeDefined();
    feed.reset();
    expect(feed.next(w)).toBeDefined();
    first['x'] = (first['x'] as number) - 1;
  });

  it('words snow and prints on a tile, with the melt rule and the fade', () => {
    const herd = herdsOf(w)[0]!;
    const [x, y] = [herd['x'] as number, herd['y'] as number];
    const i = y * w.map.width + x;
    expect(tileView(w, x, y, 0, nobody)!.snowLies).toBeUndefined();
    w.map.snowLie[i] = 1;
    w.map.printKind[i] = 1;
    w.map.printAt[i] = w.tick - 3 * 60;
    w.map.printDir[i] = 3;
    const tile = tileView(w, x, y, 0, nobody)!;
    expect(tile.snowLies).toBe(
      `lying; it goes on the next day above about ${content.seasons.snowMelt} °C`,
    );
    expect(tile.prints).toBe('paw prints, about 3 hours old, heading south-east');
    expect(tile.fade).toBe(`gone in about ${content.wild.printHours - 3} hours`);
  });

  it('counts the hides, bone and fat and the game and fish', () => {
    const view = leftoversView(w);
    expect(view.items.map((i) => i.item)).toEqual(['hide', 'bone', 'fat']);
    expect(view.items.every((i) => i.have === 0)).toBe(true);
    expect([view.game, view.fish]).toEqual([0, 0]);
  });
});
