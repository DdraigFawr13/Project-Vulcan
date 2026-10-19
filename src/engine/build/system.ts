// The build system (P3.1, P3.2, P3.7, P3.8): owns the plans, houses and the green. Colonists site
// houses themselves from the Build sheet's `setBuild` level (houses.ts), and a plan can be sent
// back once (`sendBack`); placing a part on a chosen tile (`placeBuilding`) and `deconstruct`
// stay test-mode tools (V-041, V-049). Builders take the work up themselves (people/build.ts).
// Each hour it finishes houses whose parts stand, sites a house while people sleep in the open,
// grows a house that has outgrown its beds, and says once when nobody is able to build.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { inStore, itemsAt, itemsOf, raiseStock } from '../goods/index.ts';
import type { Spot } from '../paths/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { FURNITURE_TABLES } from './furniture.ts';
import { finishHouses, growHouses } from './grow.ts';
import { HOUSE_TABLES, planHouse, sendBack, setBuild } from './houses.ts';
import { BUILD_TABLES, partOf, planAt, planPart, plansOf } from './plans.ts';
import { planCampfire, planRoomHearths } from './hearths.ts';
import { planBench } from './wants.ts';

function refuse(ctx: SystemContext, kind: string, reason: string, cause: number): void {
  ctx.emit('command.refused', { causes: [cause], data: { kind, reason } });
}

/** Why a part cannot be planned on surface tile (x, y), or undefined when it can. */
function unfit(ctx: SystemContext, kind: string, x: number, y: number): string | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const i = y * map.width + x;
  if (!content.terrain.kinds[map.tiles[i]!]!.buildable)
    return 'the ground there cannot be built on';
  const f = map.features[i]!;
  if (f) return `a ${content.features[f - 1]!.name} is there`;
  if (planAt(world, x, y) || map.built[i]) return 'something is built or planned there';
  if (inStore(world, x, y, 0)) return 'the store is there';
  if (kind !== 'floor' && itemsAt(world, x, y, 0).length) return 'something lies there';
  return undefined;
}

/** `placeBuilding {part, x, y}` (test mode): a plan on a surface tile. */
function placeBuilding(ctx: SystemContext, data: Readonly<Record<string, unknown>>, cause: number) {
  const { world, content } = ctx;
  const map = world.map;
  const part = partOf(content, data['part'] as string);
  const [x, y] = [data['x'] as number, data['y'] as number];
  if (!part) return refuse(ctx, 'placeBuilding', 'no such part', cause);
  if (![x, y].every(Number.isInteger) || x < 0 || y < 0 || x >= map.width || y >= map.height)
    return refuse(ctx, 'placeBuilding', 'that is not a tile of the map', cause);
  const why = unfit(ctx, part.kind, x, y);
  if (why) return refuse(ctx, 'placeBuilding', why, cause);
  const line = ctx.emit('build.planned', { causes: [cause], data: { part: part.name, x, y } });
  addEntity(world, 'plan', {
    ...{ part: part.id, x, y, z: 0, have: 0, work: -1, state: 'plan' },
    ...{ line, done: 0, waited: 0, shut: 0, held: 0, house: 0 },
  });
  raiseStock(ctx, part.material, part.name, line);
}

/** `deconstruct {x, y}` (test mode): a part or plan there is to come down. A plan nothing was
 * brought for is dropped at once; anything else waits for a builder to take it down. */
function deconstruct(ctx: SystemContext, data: Readonly<Record<string, unknown>>, cause: number) {
  const { world, content } = ctx;
  const plan = planAt(world, data['x'] as number, data['y'] as number);
  if (!plan || plan['state'] === 'down')
    return refuse(ctx, 'deconstruct', 'nothing to take down there', cause);
  const part = planPart(content, plan);
  const at = { part: part.name, x: plan['x'] as number, y: plan['y'] as number };
  if (part.kind === 'stair' && plan['state'] === 'built')
    return refuse(ctx, 'deconstruct', 'a stair stays once cut', cause);
  if (plan['state'] === 'plan' && !(plan['have'] as number)) {
    ctx.emit('build.dropped', { causes: [cause], data: at });
    return removeEntity(world, 'plan', plan.id);
  }
  plan['line'] = ctx.emit('build.downOrdered', { causes: [cause], data: at });
  Object.assign(plan, { state: 'down', work: -1, waited: 0 });
}

/** Whether a person meets the build job's attribute requirements (jobs.json). */
function ableToBuild(content: EngineContent, p: EntityRow): boolean {
  const def = content.jobs.find((j) => j.id === content.buildings.job);
  return (
    p['status'] === 'alive' &&
    !!def &&
    Object.entries(def.requirements).every(([a, need]) => ((p[a] as number) ?? 0) >= need)
  );
}

/** The green (V-050): the tile where the cart first stopped, fixed when the world begins. */
export function greenOf(world: WorldState): Spot {
  const at = (world.systems['build']?.['green'] ?? 0) - 1;
  const map = world.map;
  return at < 0
    ? { x: map.startX, y: map.startY, z: 0 }
    : { x: at % map.width, y: Math.floor(at / map.width), z: 0 };
}

/** The colony sites again at once after a plan is sent back: a house for the homeless, or the
 * room a house needs. */
function chooseAgain(ctx: SystemContext, h: EntityRow, line: number): void {
  const green = greenOf(ctx.world);
  if (h['of']) growHouses(ctx, green, 1, h['of'] as number);
  else planHouse(ctx, green, [line], 1);
}

export const buildSystem: System = {
  id: 'build',
  every: 'hour',
  emits: [
    'build.planned',
    'build.dropped',
    'build.downOrdered',
    'build.nobody',
    'build.wantSet',
    'build.needed',
    'build.noGround',
    'build.sited',
    'build.sentBack',
    'build.houseBuilt',
    'build.roomAdded',
    'build.grows',
    'build.growsPrivate',
    'furniture.benchPlaced',
    'fire.planned',
    'fire.plannedCold',
    'fire.noFloor',
  ],
  // `nobody`: the line saying nobody is able to build, while that holds; `green`: the green's
  // tile index plus one; `need`: the line saying people sleep in the open, while they do;
  // `noGround`: the alert that no ground near the green fits a house, while none does, and
  // `tried` the tick it last looked.
  initialState: { nobody: 0, green: 0, need: 0, noGround: 0, tried: 0 },
  refs: ['nobody', 'need', 'noGround'],
  tables: { ...BUILD_TABLES, ...HOUSE_TABLES, ...FURNITURE_TABLES },
  commands: {
    placeBuilding: (ctx, command, cause) => placeBuilding(ctx, command.data, cause),
    deconstruct: (ctx, command, cause) => deconstruct(ctx, command.data, cause),
    setBuild: (ctx, command, cause) => setBuild(ctx, command.data, cause),
    sendBack: (ctx, command, cause) =>
      sendBack(ctx, command.data, cause, (h, line) => chooseAgain(ctx, h, line)),
  },
  init(ctx) {
    const { world, content, state } = ctx;
    const cart = itemsOf(world).find((i) => i['kind'] === content.life.cart.kind);
    const map = world.map;
    if (cart) state['green'] = (cart['y'] as number) * map.width + (cart['x'] as number) + 1;
  },
  run(ctx) {
    const { world } = ctx;
    const green = greenOf(world);
    // The first fire is the campfire on the green, before the houses are sited round it.
    planCampfire(ctx, green);
    finishHouses(ctx);
    // A house adds a room for the homeless before another house is sited ("cottage, then grow").
    if (!growHouses(ctx, green)) planHouse(ctx, green, []);
    planBench(ctx);
    planRoomHearths(ctx);
    checkBuilders(ctx);
  },
};

/** While a plan waits and nobody living is able to build, one alert. */
function checkBuilders(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const waiting = plansOf(world).find((p) => p['state'] !== 'built');
  const someone = (world.entities['person'] ?? []).some((p) => ableToBuild(content, p));
  if (!waiting || someone) {
    state['nobody'] = 0;
    return;
  }
  if (state['nobody']) return;
  state['nobody'] = ctx.emit('build.nobody', {
    causes: [waiting['line'] as number],
    data: {
      part: planPart(content, waiting).name,
      x: waiting['x'] as number,
      y: waiting['y'] as number,
    },
  });
}
