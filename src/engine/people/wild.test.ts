// Phase 5 Bundle 2, the people's side of the wild valley (V-041, V-072, V-109 to V-112, V-122):
// a hunter takes a deer from a herd and leaves it its last three; fishing yields fish and stops on
// frozen water; a bold armed pair stands and a lone timid person runs for a house; an attack's
// line leads back through the sighting to the pack's hunger; the first offal makes a midden.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { clockAt, streamFor, type EntityRow } from '../core/index.ts';
import { greenOf, middensOf, ringOf, roomAt, housesOf } from '../build/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { freeTile, HELD, itemsOf, layItem, toolOf } from '../goods/index.ts';
import { emit, templatesOf, whyOf } from '../log/index.ts';
import { reachFrom, walkAt, type Spot } from '../paths/index.ts';
import {
  createSim,
  createWorld,
  step,
  submitCommand,
  type SystemContext,
  type WorldState,
} from '../index.ts';
import { memoriesOf } from '../needs/index.ts';
import { animalsOf, herdsOf, packOf, spareCount } from '../wild/index.ts';

const sim = createSim(content);
const DAY = 1440;
const lines = (w: WorldState, type: string) => w.log.filter((e) => e.type === type);
const people = (w: WorldState): EntityRow[] => w.entities['person'] ?? [];
const hourOf = (w: WorldState) => clockAt(w.tick, content.calendar).hour;
const contextOf = (w: WorldState): SystemContext => ({
  world: w,
  content,
  state: w.systems['people']!,
  rng: () => streamFor(w, 'people'),
  emit: (type, fields) => emit(w, templatesOf(content.events), type, fields),
});

/** Open, flat, dry ground the green can reach, `d` tiles (the larger axis) from it and clear of
 * `avoid`: the first by scan order. */
function groundAt(w: WorldState, d: number, avoid: Spot[] = []): Spot {
  const map = w.map;
  const green = greenOf(w);
  const reach = reachFrom(content, map, green);
  for (let y = green.y - d; y <= green.y + d; y += 1)
    for (let x = green.x - d; x <= green.x + d; x += 1) {
      if (Math.max(Math.abs(x - green.x), Math.abs(y - green.y)) !== d) continue;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const i = y * map.width + x;
      const far = avoid.every((a) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) > 9);
      if (
        far &&
        walkAt(content, map, 0, i) === 1 &&
        freeTile(w, content, x, y) &&
        !map.features[i] &&
        reach({ x, y, z: 0 })
      )
        return { x, y, z: 0 };
    }
  throw new Error('no ground');
}

/** Strength, agility and perception for the work, food down to a hundred, and `job` put first by
 * everyone (the player's lever: the band is felling and hauling at the start). */
function hungry(w: WorldState, job: string): void {
  for (const p of people(w))
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setPriority',
      data: { person: p.id, job, level: 1 },
    });
  for (const p of people(w)) Object.assign(p, { strength: 12, agility: 12, perception: 12 });
  let left = 100;
  for (const i of [...itemsOf(w)]) {
    if (content.items.find((c) => c.id === i['kind'])?.good !== 'food') continue;
    if (left >= (i['count'] as number)) left -= i['count'] as number;
    else removeEntity(w, 'item', i.id);
  }
}

describe('hunting and fishing', () => {
  it('takes a deer from a herd brought near and leaves it its last three', () => {
    const w = createWorld(sim, 'anvil/1');
    hungry(w, 'hunt');
    const herd = herdsOf(w).find((h) => h['species'] === 'deer')!;
    const at = groundAt(w, 24);
    Object.assign(herd, { x: at.x, y: at.y });
    const members = animalsOf(w).filter((a) => a['herd'] === herd.id);
    for (const a of members) Object.assign(a, { x: at.x, y: at.y, path: [], state: '' });
    const hunters = new Set<number>();
    for (let h = 0; h < 4 * 24 && !lines(w, 'wild.killed').some((l) => l.actors.length); h += 1)
      step(w, sim, 60);
    const kill = lines(w, 'wild.killed').find((l) => l.actors.length)!;
    expect(kill, 'a kill within four days').toBeDefined();
    hunters.add(kill.actors[0]!);
    expect(w.log.find((e) => e.id === kill.causes[0])?.type).toBe('work.tookUpHunting');
    // Hunting on until the herd is down to its spare, never past it.
    step(w, sim, 6 * DAY);
    const left = animalsOf(w).filter((a) => a['herd'] === herd.id).length;
    expect(left).toBeGreaterThanOrEqual(spareCount(content));
    expect(lines(w, 'wild.killed').length).toBeLessThanOrEqual(members.length - left);
  });

  it('fishes the open water for fish and stops when the water freezes', () => {
    const w = createWorld(sim, 'anvil/1');
    hungry(w, 'fish');
    step(w, sim, 3 * DAY);
    const caught = w.systems['people']!['fished']!;
    expect(lines(w, 'work.tookUpFishing').length).toBeGreaterThan(0);
    expect(caught).toBeGreaterThan(0);

    // Ice on every water tile: no more fish, and the angler is off the water.
    for (let h = 0; h < 12; h += 1) {
      for (let i = 0; i < w.map.water.length; i += 1)
        if (w.map.water[i]) w.map.ice[i] = w.map.ice[i]! | 0x80;
      step(w, sim, 60);
    }
    const frozen = w.systems['people']!['fished']!;
    for (let h = 0; h < 6; h += 1) {
      for (let i = 0; i < w.map.water.length; i += 1)
        if (w.map.water[i]) w.map.ice[i] = w.map.ice[i]! | 0x80;
      step(w, sim, 60);
    }
    expect(w.systems['people']!['fished']).toBe(frozen);
    expect(people(w).some((p) => p['job'] === 'fish')).toBe(false);
  });
});

/** A world with a house closed, at ten in the morning. */
function housed(): WorldState {
  const w = createWorld(sim, 'anvil/1');
  const closed = () =>
    housesOf(w).some((h) => roomAt(w, content, (h['x'] as number) + 1, (h['y'] as number) + 1));
  for (let d = 0; d < 60 && !closed(); d += 1) step(w, sim, DAY);
  expect(closed(), 'a house within 60 days').toBe(true);
  while (hourOf(w) !== 10) step(w, sim, 60);
  return w;
}

const traitsOf = (w: WorldState, p: EntityRow, traits: string[]): void => {
  for (const t of (w.entities['trait'] ?? []).filter((r) => r['person'] === p.id))
    removeEntity(w, 'trait', t.id);
  for (const trait of traits) addEntity(w, 'trait', { person: p.id, trait });
};

const place = (a: EntityRow, at: Spot): void => {
  Object.assign(a, {
    ...{ x: at.x, y: at.y, z: 0, path: [], state: '', job: '', target: -1, doing: '', stride: 0 },
  });
};

describe('a wolf in sight', () => {
  const w = housed();
  const [a, b, c] = people(w) as [EntityRow, EntityRow, EntityRow];
  const wolves = animalsOf(w).filter((x) => x['pack']);

  it('has a bold armed pair stand and a lone timid person run for the house', () => {
    const far = groundAt(w, 16);
    const green = greenOf(w);
    traitsOf(w, a, ['steady']);
    traitsOf(w, b, ['hardy']);
    traitsOf(w, c, ['melancholic']);
    const axes = itemsOf(w).filter((i) => toolOf(content, i)?.kind === 'axe');
    for (const [axe, p] of [
      [axes[0]!, a],
      [axes[1]!, b],
    ] as const)
      Object.assign(axe, { owner: p.id, state: 'held', ...HELD });
    for (const p of people(w).slice(3)) place(p, { ...green, z: 0 });
    place(a, far);
    place(b, {
      ...far,
      x: far.x + (walkAt(content, w.map, 0, far.y * w.map.width + far.x + 1) ? 1 : -1),
    });
    place(c, green);
    place(wolves[0]!, { ...far, y: far.y + (far.y > green.y ? 2 : -2) });
    place(wolves[1]!, { ...green, x: green.x + 2 });
    step(w, sim, 1);
    expect([a['doing'], b['doing'], c['doing']]).toEqual(['stand', 'stand', 'flee']);
    const sighted = lines(w, 'wild.sighted')[0]!;
    expect(sighted.data['stood']).toContain(`${a['name']} and ${b['name']} stood with their axes`);
    expect(sighted.data['stood']).toContain('hardy, steady, side by side');
    expect(sighted.data['ran']).toContain(c['name']);
    expect(sighted.data['ran']).toContain('ran for the');
    for (const m of [a, b, c]) expect(sighted.actors).toContain(m.id);
    step(w, sim, 60);
    expect(roomAt(w, content, c['x'] as number, c['y'] as number)).toBeDefined();
    expect(c['doing']).toBe('flee');
  });

  it("leads an attack back through the sighting to the pack's hunger", () => {
    // Night, the pack starving; one person alone in the open with a wolf beside them.
    while (hourOf(w) !== 22) step(w, sim, 60);
    const pack = packOf(w)!;
    const ctx = contextOf(w);
    pack['hungryLine'] = ctx.emit('wild.packHungry', {
      causes: [pack['line'] as number],
      data: {
        name: pack['name'] as string,
        days: 16,
        left: 'the herds are low',
        why: 'the winter is hard',
      },
    });
    pack['hunger'] = 16;
    const lone = people(w)[3]!;
    const spot = groundAt(w, 12);
    for (const p of people(w)) place(p, p === lone ? spot : greenOf(w));
    for (const x of wolves)
      Object.assign(x, { x: pack['denX'], y: pack['denY'], path: [], state: '' });
    place(wolves[0]!, {
      ...spot,
      x: spot.x + (walkAt(content, w.map, 0, spot.y * w.map.width + spot.x + 1) ? 1 : -1),
    });
    step(w, sim, 1);
    const attacked = lines(w, 'wild.attacked');
    expect(attacked).toHaveLength(1);
    expect(attacked[0]!.actors[0]).toBe(lone.id);
    const chain = whyOf(w, attacked[0]!.id).map((c) => c.event.type);
    expect(chain).toContain('wild.sighted');
    expect(chain).toContain('wild.packHungry');
    expect(pack['attacked']).toBe(attacked[0]!.id);
    expect(lines(w, 'wild.packDrewOff')[0]!.causes).toEqual([attacked[0]!.id]);
  });
});

describe('wolf tracks', () => {
  const print = (w: WorldState, at: Spot): void => {
    const i = at.y * w.map.width + at.x;
    w.map.printKind[i] = content.wild.prints.findIndex((p) => p.id === 'paw') + 1;
    w.map.printAt[i] = w.tick;
    w.map.printDir[i] = 2;
  };

  it('are found once a day near the town, and remembered by whoever steps on them', () => {
    const w = createWorld(sim, 'anvil/1');
    const [a, b] = people(w) as [EntityRow, EntityRow];
    print(w, { x: a['x'] as number, y: a['y'] as number, z: 0 });
    step(w, sim, 1);
    const found = lines(w, 'wild.tracksFound');
    expect(found).toHaveLength(1);
    expect(found[0]!.actors).toEqual([a.id]);
    expect(memoriesOf(w, a.id).map((m) => m['memory'])).toContain('saw-tracks');
    // The second to step on them the same day only remembers.
    print(w, { x: b['x'] as number, y: b['y'] as number, z: 0 });
    step(w, sim, 1);
    expect(lines(w, 'wild.tracksFound')).toHaveLength(1);
    expect(memoriesOf(w, b.id).map((m) => m['memory'])).toContain('saw-tracks');
  });

  it('send two hunters after the pack once it has attacked', () => {
    const w = createWorld(sim, 'anvil/1');
    for (const p of people(w)) {
      Object.assign(p, { agility: 12, perception: 12 });
      submitCommand(w, {
        tick: 1,
        kind: 'setPriority',
        data: { person: p.id, job: 'hunt', level: 1 },
      });
    }
    const pack = packOf(w)!;
    Object.assign(pack, { attacked: w.begunEvent, attackedAt: w.tick });
    const green = greenOf(w);
    print(w, { ...green, x: green.x + 2 });
    step(w, sim, 5);
    const going = lines(w, 'work.trackingPack');
    // They go in twos, each pair under one line citing the attack.
    expect(going.length).toBeGreaterThan(0);
    for (const l of going) expect(l.causes).toEqual([w.begunEvent]);
    const pair = people(w).filter((p) => p['job'] === 'hunt' && p['task'] === 'pack');
    expect(pair.map((p) => p.id).sort()).toEqual(going.flatMap((l) => l.actors).sort());
    expect(pair.length % 2).toBe(0);
  });
});

describe('the midden', () => {
  it('is sited past the town ring at the first offal, with a line, and takes the offal', () => {
    const w = createWorld(sim, 'anvil/1');
    expect(middensOf(w)).toHaveLength(0);
    const green = greenOf(w);
    const spot = groundAt(w, 3);
    layItem(w, { kind: 'offal', count: 1, x: spot.x, y: spot.y, z: 0, made: w.begunEvent });
    step(w, sim, 2 * 60);
    const midden = middensOf(w);
    expect(midden).toHaveLength(1);
    const line = lines(w, 'build.middenSited')[0]!;
    expect(midden[0]!.line).toBe(line.id);
    expect(line.causes).toEqual([w.begunEvent]);
    const d = Math.max(Math.abs(midden[0]!.x - green.x), Math.abs(midden[0]!.y - green.y));
    expect(d).toBeGreaterThan(ringOf(w, content));
    // Haulers carry the offal there and it is used up, with no line.
    const before = w.log.length;
    step(w, sim, 3 * DAY);
    expect(itemsOf(w).filter((i) => i['kind'] === 'offal')).toHaveLength(0);
    expect(
      w.log.slice(before).some((e) => e.type.startsWith('wild.') && e.type.includes('offal')),
    ).toBe(false);
  });
});
