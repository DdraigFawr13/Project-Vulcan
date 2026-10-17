// A new colony: the map, ten founders around the hearth, and the founding event.

import { emit, type EventSink } from '../core/events.ts';
import { streamFor } from '../core/rng.ts';
import {
  Feature,
  type Colonist,
  type Content,
  type SimEvent,
  type WorldState,
} from '../core/types.ts';
import { generateMap } from './mapgen.ts';
import { findNearest, tileIndex } from './path.ts';

export function createWorld(
  seed: string,
  content: Content,
): { world: WorldState; events: SimEvent[] } {
  const t = content.tuning;
  const rngOwner = { seed, rng: {} };
  const { map, hearth, store } = generateMap(rngOwner, content.map, t.treeWood, t.bushMax);
  const world: WorldState = {
    seed,
    tick: 0,
    rng: rngOwner.rng,
    map,
    colonists: [],
    colony: {
      hearth,
      store,
      stock: { ...t.startingStock },
      hearthFuel: t.fuelPerWood * 2,
      stockLowEvent: {},
      hearthOutEvent: null,
    },
    nextEventId: 1,
  };
  const nameRng = streamFor(world, 'colonists.names');
  const traitRng = streamFor(world, 'colonists.traits');
  const pool = [...content.names];
  const taken = new Set<number>();
  for (let id = 0; id < content.colonistCount; id += 1) {
    const name = pool.splice(nameRng.int(pool.length), 1)[0]!;
    // Each founder starts on the nearest free open tile around the hearth.
    const start = tileIndex(map, hearth.x, hearth.y);
    const spot = findNearest(map, start, (i) => map.feature[i] === Feature.None && !taken.has(i));
    const index = spot && spot.length ? spot[spot.length - 1]! : start;
    taken.add(index);
    const colonist: Colonist = {
      id,
      name,
      x: index % map.width,
      y: Math.floor(index / map.width),
      needs: {
        food: traitRng.between(550, t.needMax),
        rest: traitRng.between(600, t.needMax),
        company: traitRng.between(500, t.needMax),
      },
      task: { kind: 'idle' },
      path: [],
      carrying: null,
      claim: -1,
      likes: traitRng.pick(content.jobs).id,
      openNeedEvents: {},
    };
    world.colonists.push(colonist);
  }
  const sink: EventSink = { events: [] };
  emit(world, content, sink, 'colony.founded', {
    actors: world.colonists.map((c) => c.id),
    place: hearth,
    data: { count: world.colonists.length },
  });
  return { world, events: sink.events };
}
