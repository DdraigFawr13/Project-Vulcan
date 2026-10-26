// Bundle 3 as the page shows it: Work rows that wait for their station (V-071), the Smithy row,
// a smelter's tile page and map piece, the Bronze plate's note, and the item page that walks a
// tool's trail back to the ore (P4.6) and a person's tools, and the cart they are kept in.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, itemsOf, storeOf, type WorldState } from '../engine/index.ts';
import { addEntity } from '../engine/entity/index.ts';
import { layItem } from '../engine/goods/index.ts';
import { layTool, restOf } from '../engine/goods/index.ts';
import { buildView } from './build.ts';
import { stationGoods } from './works.ts';
import { goodsOf, stockView, tileGoods } from './goods.ts';
import { itemView, personTools } from './items.ts';
import { walkersOf } from './people.ts';

const sim = createSim(content);
const nobody = () => ({}) as never;
const rows = (world: WorldState) => walkersOf(world)[0]!.work.map((j) => j.job);

/** A smelter row on a free tile near the start, built or planned. */
function smelter(world: WorldState, state: string) {
  const [x, y] = [world.map.startX + 3, world.map.startY + 3];
  addEntity(world, 'station', {
    ...{ kind: 'smelter', x, y, z: 0, w: 1, h: 1, state, line: 0, have: 0, work: -1 },
    ...{ made: 0, lit: 0, litLine: 0, alert: 0, waitFor: '' },
  });
  return { x, y };
}

describe('the metal screens', () => {
  it('keeps the Charcoal, Smelting and Smithing rows off the Work sheet until their station exists', () => {
    const world = createWorld(sim, 'ledger/1');
    for (const job of ['charcoal', 'smelt', 'smith']) expect(rows(world)).not.toContain(job);
    smelter(world, 'plan');
    expect(rows(world)).not.toContain('smelt');
    world.entities['station']![0]!['state'] = 'built';
    expect(rows(world)).toContain('smelt');
    expect(rows(world)).not.toContain('smith');
  });

  it('shows the four ingot plates, Bronze with its note, and the Smithy row once an ingot is stored', () => {
    const world = createWorld(sim, 'ledger/1');
    const plates = stockView(world).filter((s) => s.good.endsWith('-ingot'));
    expect(plates.map((s) => s.good).sort()).toEqual(
      ['bronze-ingot', 'copper-ingot', 'iron-ingot', 'tin-ingot'].sort(),
    );
    expect(plates.find((s) => s.good === 'bronze-ingot')?.note).toMatch(/3 copper and 1 tin/);
    expect(buildView(world).smithy).toBeUndefined();
    const store = storeOf(world)[0]!;
    layItem(world, {
      ...{ kind: 'iron-ingot', count: 2, made: 0 },
      ...{ x: store['x'] as number, y: store['y'] as number, z: 0 },
    });
    const row = buildView(world).smithy!;
    expect(row.want.level).toBe(content.buildings.smithy.start);
    expect(row.plan).toBeUndefined();
  });

  it('draws the smelter and words its tile page: what, why here, makes and what is in the store', () => {
    const world = createWorld(sim, 'ledger/1');
    const { x, y } = smelter(world, 'built');
    expect(goodsOf(world).furniture.map((f) => f.art)).toContain('furn.smelter');
    const page = tileGoods(world, x, y, 0, nobody).works!;
    expect(page.name).toBe('Smelter');
    const keys = page.rows.map(([k]) => k);
    expect(keys).toEqual(['what', 'state', 'why here', 'makes', 'in the store']);
    expect(page.rows.find(([k]) => k === 'makes')![1]).toContain('3 copper ingots');
  });

  it('walks a tool\'s trail back to the ore, with a tile button and "ore tile not recorded"', () => {
    const world = createWorld(sim, 'ledger/1');
    const trail: Record<string, unknown>[] = [
      { s: 'mined', who: 'Kolbur', tick: 3000, x: 108, y: 110, z: 3, k: 'iron-ore' },
      { s: 'mined', who: '', tick: 0, k: 'copper-ore' },
      { s: 'burned', who: 'Rurikin', tick: 3100, n: 5 },
      { s: 'smelted', who: 'Skafar', tick: 3200, n: 1, k: 'iron-ingot' },
      { s: 'made', who: 'Brokin', tick: 4500 },
    ];
    const tool = layTool(world, content, restOf(world, content), {
      ...{ kind: 'axe', material: 'iron', quality: 'fine', made: 0 },
      trail: JSON.stringify(trail),
    });
    const view = itemView(world, tool.id, nobody)!;
    expect(view.name).toBe('Fine iron axe');
    const facts = Object.fromEntries(view.facts);
    expect(facts['made by']).toMatch(/^Brokin, Day \d+ of \w+: fine$/);
    expect(facts['work']).toBe('60% faster than a plain stone axe');
    expect(view.steps.map((s) => s.depth)).toEqual([0, 1, 1, 1]);
    expect(view.steps[0]!.text).toMatch(
      /^1 iron ingot, smelted by Skafar, .*, from 2 iron ore and 3 charcoal$/,
    );
    expect(view.steps.find((s) => s.tile)?.tile).toEqual({
      x: 108,
      y: 110,
      z: 3,
      label: 'tile 108, 110',
    });
    expect(
      view.steps.some((s) => s.text.includes('copper ore, mined: ore tile not recorded')),
    ).toBe(true);
    expect(itemView(world, 999999, nobody)).toBeUndefined();
  });

  it("lists a person's tools with their hours left and gives tools and ingots a page link", () => {
    const world = createWorld(sim, 'ledger/1');
    const [person] = world.entities['person']!;
    const tool = itemsOf(world).find((i) => i['kind'] === 'stone-axe')!;
    Object.assign(tool, { owner: person!.id, state: 'held', x: -1, y: -1 });
    expect(personTools(world, person!.id)).toEqual([
      { id: tool.id, kind: 'axe', text: expect.stringMatching(/^stone axe, \d+ hours left$/) },
    ]);
    expect(walkersOf(world)[0]!.tools).toHaveLength(1);
    const cart = restOf(world, content);
    const goods = tileGoods(world, cart.x, cart.y, cart.z, nobody).goods ?? [];
    expect(goods.some((g) => g.item !== undefined)).toBe(true);
  });

  it('has a frame in the packed sheets for every metal piece and item the page draws', () => {
    const frames = (sheet: string) =>
      new Set(
        Object.keys(JSON.parse(readFileSync(`public/art/${sheet}.json`, 'utf8')).frames as object),
      );
    const [buildings, items] = [frames('buildings'), frames('items')];
    const world = createWorld(sim, 'ledger/1');
    smelter(world, 'built');
    const clamp = { kind: 'clamp', x: 5, y: 5, z: 0, w: 2, h: 2, line: 0, have: 0, work: -1 };
    for (const state of ['idle', 'lit'])
      addEntity(world, 'station', {
        ...{ ...clamp, state, made: 0, lit: 0, litLine: 0, alert: 0, waitFor: '' },
      });
    const art = stationGoods(world);
    expect(art.length).toBe(1 + 4 + 4);
    for (const p of art) {
      // The page uses `<art>.<facing>` when the sheet has it, else the art, and cycles `.1` to `.3`.
      const named = buildings.has(`${p.art}.${p.facing}`) ? `${p.art}.${p.facing}` : p.art;
      expect(buildings.has(named) || buildings.has(`${named}.1`), `${named}`).toBe(true);
    }
    for (const def of content.items.filter(
      (i) => i.tool || i.good === 'metal' || i.id === 'charcoal',
    ))
      expect(items.has(`item.${def.id}`), def.id).toBe(true);
    for (const kind of ['forge', 'anvil', 'tub'])
      expect(buildings.has(`furn.${kind}`), kind).toBe(true);
  });
  it('draws the cart on its tile, not the tools kept in it, and lists them there', () => {
    // Morgan's playtest 2026-10-19: the twelve stone tools lay over the cart and hid it.
    for (const seed of ['anvil', 'smoke', 'tallow']) {
      const world = createWorld(sim, seed);
      const { x, y, z } = restOf(world, content);
      const drawn = goodsOf(world).items.filter((i) => i.x === x && i.y === y && i.z === z);
      expect(drawn.map((i) => i.frame)).toEqual(['cart']);
      const listed = tileGoods(world, x, y, z, nobody).goods!.map((g) => g.text);
      expect(listed).toContain('handcart');
      // Three of each tool kind the cart brings (axes, picks, hoes, hammers, spears; no healer's kit).
      expect(listed.filter((t) => t.startsWith('stone '))).toHaveLength(
        content.tools.kinds.reduce((n, k) => n + (k.cart ?? content.tools.cart), 0),
      );
    }
  });
});
