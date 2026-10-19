// Bundle 3 (V-088, V-041): tools and smithing. A fine pick works faster than a poor one; a
// broken axe is replaced, unordered, by one made for whoever fells most; free tools go to the
// person who works a kind most; smithing is drawn apart from the band, so a seed's band is as it
// was; the band arrives with stone tools of each kind.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  itemsOf,
  step,
  submitCommand,
  whyOf,
  streamFor,
} from '../index.ts';
import { addEntity } from '../entity/index.ts';
import {
  freeTile,
  freeTools,
  heldBy,
  HELD,
  inStore,
  layItem,
  layTool,
  restOf,
  storeOf,
  toolOf,
} from '../goods/index.ts';
import { valleyOf } from '../region/index.ts';
import { drawBand, toolFactor } from './index.ts';

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

/** A standing forge beside the cart. */
function setForge(w: World): void {
  const spot = restOf(w, content);
  const unloaded = lines(w, 'goods.unloaded')[0]!.id;
  addEntity(w, 'furniture', {
    ...{ kind: 'forge', x: spot.x + 1, y: spot.y, z: 0, facing: 's', quality: 0, maker: 0 },
    ...{ owner: 0, made: unloaded, line: unloaded, state: 'built', have: 0, work: 0, waited: 0 },
  });
}

/** Lays `count` of `kind` on an empty store tile. */
function stock(w: World, kind: string, count: number): void {
  const at = storeOf(w).find(
    (s) => !itemsOf(w).some((i) => i['x'] === s['x'] && i['y'] === s['y']),
  )!;
  layItem(w, { kind, count, x: at['x'] as number, y: at['y'] as number, z: 0, made: 1 });
}

describe('smithing and the band', () => {
  it('leaves names and every other skill of a seed as the band draw makes them', () => {
    for (const seed of ['ledger', 'tallow', 'anvil']) {
      const world = createWorld(sim, seed);
      const near = valleyOf(world.seed, content)?.valley.near ?? [];
      const homes = near
        .map((n) => ({
          name: n.name,
          culture:
            content.cultures.find((c) => c.id === n.culture || c.name === n.culture)?.id ?? '',
          days: n.days,
          dir: n.dir,
        }))
        .filter((h) => h.culture);
      if (!homes.length)
        homes.push({ name: '', culture: content.band.homeCulture, days: 0, dir: '' });
      const band = drawBand(streamFor({ seed, rng: {} }, 'people'), content, homes);
      expect(people(world).map((p) => p['name'])).toEqual(band.map((p) => p.name));
      people(world).forEach((p, k) => {
        const rows = (world.entities['skill'] ?? []).filter((s) => s['person'] === p.id);
        for (const id of content.band.skills) {
          const row = rows.find((s) => s['skill'] === id)!;
          expect([row['level'], row['potential']]).toEqual([
            band[k]!.skills[id]!.level,
            band[k]!.skills[id]!.potential,
          ]);
        }
        const smithing = rows.find((s) => s['skill'] === 'smithing')!;
        expect(smithing['level']).toBeLessThanOrEqual(smithing['potential'] as number);
        expect(p['trade']).toBe(band[k]!.trade);
      });
    }
  });

  it('arrives with stone tools of each kind, kept with the cart, citing the unloading', () => {
    const w = createWorld(sim, 'ledger');
    const unloaded = lines(w, 'goods.unloaded')[0]!;
    for (const kind of content.tools.kinds) {
      const free = freeTools(w, content, kind.id);
      expect(free).toHaveLength(content.tools.cart);
      for (const t of free) {
        expect(t['kind']).toBe(`stone-${kind.id}`);
        expect(t['made']).toBe(unloaded.id);
        expect({ x: t['x'], y: t['y'] }).toEqual({
          x: restOf(w, content).x,
          y: restOf(w, content).y,
        });
      }
    }
    // The store keeps its tiles for goods.
    expect(storeOf(w)).toHaveLength(content.work.store.width * content.work.store.height);
  });
});

describe('tools in use', () => {
  /** The ticks from the first boulder-quarrying line to its end, with every person holding a
   * pick of this quality. */
  function quarryTime(quality: string): number {
    const w = createWorld(sim, 'ledger');
    clearFree(w, 'pick');
    for (const p of people(w)) {
      const pick = layTool(w, content, restOf(w, content), {
        ...{ kind: 'pick', material: 'stone', quality, made: lines(w, 'goods.unloaded')[0]!.id },
      });
      hand(pick, p.id);
    }
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setStock',
      data: { good: 'stone', level: 'some' },
    });
    step(w, sim, 4 * DAY);
    const broke = lines(w, 'work.felled').find((e) => e.data['verb'] === 'broke up')!;
    expect(broke).toBeDefined();
    const took = allLines(w).find((e) => e.id === broke.causes[0])!;
    return broke.tick - took.tick;
  }

  it('works a fine pick measurably faster than a poor one', () => {
    expect(quarryTime('fine')).toBeLessThan(quarryTime('poor'));
  });

  it('works at 0.75 with no tool and at a stone tool speed with one', () => {
    const w = createWorld(sim, 'ledger');
    const p = people(w)[0]!;
    expect(toolFactor(w, content, p.id, 'fell')).toBe(0.75);
    hand(freeTools(w, content, 'axe')[0]!, p.id);
    expect(toolFactor(w, content, p.id, 'fell')).toBe(1);
    expect(toolFactor(w, content, p.id, 'split')).toBe(1);
    expect(toolFactor(w, content, p.id, 'farm')).toBe(0.75);
  });

  it('replaces a broken stone axe with an iron one made for whoever fells most, unordered', () => {
    const w = createWorld(sim, 'ledger');
    const [a] = people(w);
    const unloaded = lines(w, 'goods.unloaded')[0]!.id;
    clearFree(w, 'axe');
    const old = layTool(w, content, restOf(w, content), {
      ...{ kind: 'axe', material: 'stone', quality: 'plain', made: unloaded },
    });
    hand(old, a!.id);
    old['wear'] = 5;
    addEntity(w, 'usage', { person: a!.id, kind: 'axe', minutes: 5000 });
    // A standing forge, two iron ingots and charcoal in the store, and wood wanted.
    setForge(w);
    stock(w, 'iron-ingot', 2);
    stock(w, content.tools.charcoal, 1);
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setStock',
      data: { good: 'logs', level: 'plenty' },
    });
    const commands = w.commandLog.length;
    step(w, sim, 6 * DAY);
    expect(w.commandLog).toHaveLength(commands);
    const broke = lines(w, 'tool.broke')[0]!;
    expect(broke.actors).toEqual([a!.id]);
    const made = lines(w, 'smith.made').find((e) => String(e.data['what']).includes('iron axe'))!;
    expect(made).toBeDefined();
    // One axe was made, and nobody took up smithing it again afterwards.
    expect(
      lines(w, 'smith.made').filter((e) => String(e.data['what']).includes('axe')),
    ).toHaveLength(1);
    expect(lines(w, 'work.tookUpSmithing').filter((e) => e.id > made.id)).toEqual([]);
    // Made for the feller, whoever smithed it ("for themself" when they did).
    const forWhom = made.data['who'] === 'themself' ? made.data['name'] : made.data['who'];
    expect(forWhom).toBe(a!['name']);
    const mine = heldBy(w, content, a!.id).filter((t) => kindOf(t) === 'axe');
    expect(mine.map((t) => t['kind'])).toContain('iron-axe');
    // It traces to the smith taking it up, which traces to the forge; nobody ordered it.
    const why = whyOf(w, made.id).map((c) => c.event.type);
    expect(why).toContain('work.tookUpSmithing');
  });

  it('gives a better free tool at dawn to whoever works that kind most', () => {
    const w = createWorld(sim, 'ledger');
    const [a, b] = people(w);
    const unloaded = lines(w, 'goods.unloaded')[0]!.id;
    clearFree(w, 'axe');
    const stone = (who: number) => {
      const t = layTool(w, content, restOf(w, content), {
        ...{ kind: 'axe', material: 'stone', quality: 'plain', made: unloaded },
      });
      hand(t, who);
      return t;
    };
    // Everyone has a stone axe, so nobody takes the bronze one when starting work.
    const [sa, sb] = [stone(a!.id), stone(b!.id)];
    for (const p of people(w).slice(2)) stone(p.id);
    const bronze = layTool(w, content, restOf(w, content), {
      ...{ kind: 'axe', material: 'bronze', quality: 'fine', made: unloaded },
    });
    addEntity(w, 'usage', { person: a!.id, kind: 'axe', minutes: 9000 });
    addEntity(w, 'usage', { person: b!.id, kind: 'axe', minutes: 10 });
    step(w, sim, 2 * DAY);
    expect(bronze['owner']).toBe(a!.id);
    expect(sb['owner']).toBe(b!.id);
    // Their old one goes back to the cart for others.
    expect(sa['owner']).toBe(0);
    expect(freeTools(w, content, 'axe').map((t) => t.id)).toContain(sa.id);
    const taken = lines(w, 'tool.taken').find((e) => e.actors[0] === a!.id)!;
    expect(taken.causes).toContain(unloaded);
  });

  it('has a worn stone tool ask for bronze, so miners sink a shaft with no plate raised', () => {
    // Morgan's card (P4.9): a tool under its worn line wants the next material's ingots.
    const w = createWorld(sim, 'tallow');
    step(w, sim, 4 * DAY);
    expect(w.commandLog).toHaveLength(0);
    const worn = lines(w, 'tool.worn')[0]!;
    expect(worn.data['better']).toBe('bronze');
    expect(String(worn.data['ingot'])).toBe('bronze ingots');
    const shaft = lines(w, 'mine.shaftPlanned')[0]!;
    expect(shaft.causes).toContain(worn.id);
    expect(whyOf(w, shaft.id).map((c) => c.event.type)).toContain('tool.worn');
  });

  it('says once, naming the plates to raise, that a tool waits for ingots', () => {
    const w = createWorld(sim, 'ledger');
    const [a] = people(w);
    clearFree(w, 'axe');
    addEntity(w, 'usage', { person: a!.id, kind: 'axe', minutes: 5000 });
    setForge(w);
    step(w, sim, 3 * DAY);
    const alerts = lines(w, 'smith.noIngots');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.data['tool']).toBe('axe');
    expect(String(alerts[0]!.data['lack'])).toBe('bronze or iron ingots');
    expect(String(alerts[0]!.data['fix']).toLowerCase()).toContain('iron ingot');
    expect(lines(w, 'smith.made')).toHaveLength(0);
  });

  it('does not make a tool again for a poor one of the best material', () => {
    const w = createWorld(sim, 'ledger');
    const unloaded = lines(w, 'goods.unloaded')[0]!.id;
    clearFree(w, 'axe');
    for (const p of people(w)) {
      const axe = layTool(w, content, restOf(w, content), {
        ...{ kind: 'axe', material: 'iron', quality: 'poor', made: unloaded },
      });
      hand(axe, p.id);
      addEntity(w, 'usage', { person: p.id, kind: 'axe', minutes: 5000 });
    }
    setForge(w);
    stock(w, 'iron-ingot', 2);
    stock(w, content.tools.charcoal, 2);
    step(w, sim, 3 * DAY);
    const axes = (e: { data: Record<string, unknown> }) => String(e.data['what']).includes('axe');
    expect(lines(w, 'smith.made').filter(axes)).toEqual([]);
    expect(lines(w, 'work.tookUpSmithing').filter(axes)).toEqual([]);
  });

  it('makes a tool from ingots and charcoal lying just outside a full store', () => {
    const w = createWorld(sim, 'ledger');
    const [a] = people(w);
    clearFree(w, 'axe');
    addEntity(w, 'usage', { person: a!.id, kind: 'axe', minutes: 5000 });
    setForge(w);
    // The ingots and charcoal lie on free ground beside the store.
    const spot = restOf(w, content);
    const free: { x: number; y: number }[] = [];
    for (let r = 1; r < 12; r += 1)
      for (let y = spot.y - r; y <= spot.y + r; y += 1)
        for (let x = spot.x - r; x <= spot.x + r; x += 1)
          if (!free.some((f) => f.x === x && f.y === y) && freeTile(w, content, x, y))
            free.push({ x, y });
    const outside = free.splice(0, 2);
    // The store is at its largest and every tile holds logs, so nothing can be carried in.
    for (const at of free.splice(0, content.work.store.most - storeOf(w).length))
      addEntity(w, 'store', { ...at, z: 0, made: 1 });
    for (const t of storeOf(w)) {
      const [x, y] = [t['x'] as number, t['y'] as number];
      if (!itemsOf(w).some((i) => i['x'] === x && i['y'] === y))
        layItem(w, { kind: 'logs', count: 1, x, y, z: 0, made: 1 });
    }
    expect(storeOf(w)).toHaveLength(content.work.store.most);
    const [ingots, charcoal] = [
      layItem(w, { kind: 'iron-ingot', count: 2, ...outside[0]!, z: 0, made: 1 }),
      layItem(w, { kind: content.tools.charcoal, count: 1, ...outside[1]!, z: 0, made: 1 }),
    ];
    const lies = (id: number) => itemsOf(w).find((i) => i.id === id)!;
    for (const id of [ingots, charcoal]) expect(lies(id)['holder']).toBeFalsy();
    // The smith takes the work up with them lying outside.
    for (let t = 0; t < 4 * DAY && !lines(w, 'work.tookUpSmithing').length; t += 5) step(w, sim, 5);
    expect(lines(w, 'work.tookUpSmithing')).toHaveLength(1);
    expect(inStore(w, lies(ingots)['x'] as number, lies(ingots)['y'] as number, 0)).toBe(false);
    step(w, sim, 3 * DAY);
    const made = lines(w, 'smith.made').find((e) => String(e.data['what']).includes('iron axe'));
    expect(made).toBeDefined();
  });

  it('burns charcoal for a tool want when the ingots are in and the charcoal is not', () => {
    const w = createWorld(sim, 'ledger');
    const [a] = people(w);
    clearFree(w, 'axe');
    addEntity(w, 'usage', { person: a!.id, kind: 'axe', minutes: 5000 });
    setForge(w);
    stock(w, 'iron-ingot', 2);
    stock(w, 'logs', 30);
    // The smelter stands and the clamp is planned, as the metal chain leaves them.
    const map = w.map;
    const open = (size: number, from: number) => {
      const spot = restOf(w, content);
      for (let r = from; r < 14; r += 1)
        for (let y = spot.y - r; y <= spot.y + r; y += 1)
          for (let x = spot.x - r; x <= spot.x + r; x += 1) {
            const tiles = [...Array(size * size).keys()].map(
              (k) => (y + Math.floor(k / size)) * map.width + x + (k % size),
            );
            const ok = tiles.every((i) => {
              const kind = content.terrain.kinds[map.tiles[i]!]!;
              const [tx, ty] = [i % map.width, Math.floor(i / map.width)];
              return (
                kind.buildable &&
                !kind.water &&
                !map.features[i] &&
                !itemsOf(w).some((it) => it['x'] === tx && it['y'] === ty) &&
                !(w.entities['station'] ?? []).some(
                  (s) =>
                    Math.abs((s['x'] as number) - tx) < 3 && Math.abs((s['y'] as number) - ty) < 3,
                )
              );
            });
            if (ok) return { x, y };
          }
      throw new Error('no open ground');
    };
    const smelter = open(1, 4);
    const row = (kind: string, at: { x: number; y: number }, size: number, state: string) =>
      addEntity(w, 'station', {
        ...{ kind, x: at.x, y: at.y, z: 0, w: size, h: size, state, line: 1, have: 0, work: -1 },
        ...{ made: 1, lit: 0, litLine: 0, alert: 0, waitFor: '' },
      });
    row('smelter', smelter, 1, 'built');
    row('clamp', open(2, 4), 2, 'idle');
    step(w, sim, 8 * DAY);
    expect(lines(w, 'metal.clampLit').length).toBeGreaterThan(0);
    expect(lines(w, 'metal.charcoalMade').length).toBeGreaterThan(0);
    const made = lines(w, 'smith.made').find((e) => String(e.data['what']).includes('iron axe'));
    expect(made).toBeDefined();
    // The tool's ingots and charcoal left the store only when it was finished.
    expect(lines(w, 'smith.noIngots').map((e) => e.data['lack'])).not.toContain('iron ingots');
  });
});

describe('a first fine piece', () => {
  it('is said once for each maker, citing the piece made (V-093)', () => {
    const w = createWorld(sim, 'ledger');
    for (const s of w.entities['skill'] ?? [])
      if (s['skill'] === 'crafting') Object.assign(s, { level: 12, potential: 12 });
    step(w, sim, 5 * DAY);
    const fine = lines(w, 'craft.firstFine');
    expect(fine.length).toBeGreaterThan(0);
    expect(new Set(fine.map((e) => e.actors[0])).size).toBe(fine.length);
    const made = allLines(w).find((e) => e.id === fine[0]!.causes[0])!;
    expect(made.type).toBe('furniture.made');
    expect(made.actors[0]).toBe(fine[0]!.actors[0]);
  });
});
