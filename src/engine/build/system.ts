// The build system (P3.1, P3.2, P3.7, P3.8): owns the plans, houses and the green. Colonists site
// houses themselves from the Build sheet's `setBuild` level (houses.ts), and a plan can be sent
// back once (`sendBack`); placing a part on a chosen tile (`placeBuilding`) and `deconstruct`
// stay test-mode tools (V-041, V-049). Builders take the work up themselves (people/build.ts).
// Each hour it finishes houses whose parts stand, sites a house while people sleep in the open,
// grows a house that has outgrown its beds, and says once when nobody is able to build. Since
// P4.7 it also widens the town ring when no house fits and sites, ripens and frosts fields
// (fields.ts, fieldlife.ts, ring.ts).
import type { EngineContent, EntityRow } from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { inStore, itemsAt, itemsOf, raiseStock } from '../goods/index.ts';
import type { Spot } from '../paths/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { greenOf } from './ring.ts';
import { FURNITURE_TABLES } from './furniture.ts';
import { tickFields, markLeaving } from './fieldlife.ts';
import { finishStores, planStores } from './stores.ts';
import { FIELD_TABLES, planFields, sendBackField } from './fields.ts';
import { PASTURE_TABLES } from './pasturerows.ts';
import { finishPastures, planPasture, sendBackPasture } from './pasture.ts';
import { finishHouses, growHouses } from './grow.ts';
import { HOUSE_TABLES, planHouse, sendBack, setBuild } from './houses.ts';
import { planHomes } from './homes.ts';
import { BUILD_TABLES, partOf, planAt, planPart, plansOf } from './plans.ts';
import { planCampfire, planRoomHearths } from './hearths.ts';
import { planWell, WELL_TABLES } from './well.ts';
import { planStations } from './metalsite.ts';
import { STATION_TABLES } from './station.ts';
import { planBench } from './wants.ts';
import { planSmithy, SMITHY_TABLES, sendBackSmithy } from './smithy.ts';
import { BURIAL_TABLES, planBurial, sendBackBurial } from './burial.ts';
import { MIDDEN_TABLES, planMidden } from './midden.ts';
import { planSickroom } from './sickroom.ts';
import { finishRoads, planRoads, ROAD_TABLES } from './roads.ts';

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
    ...{ part: part.id, x, y, z: 0, have: 0, also: 0, work: -1, state: 'plan' },
    ...{ line, done: 0, waited: 0, shut: 0, held: 0, house: 0 },
  });
  raiseStock(ctx, part.material, part.name, line);
  if (part.also) raiseStock(ctx, part.also.material, part.name, line);
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
  if (plan['state'] === 'plan' && !(plan['have'] as number) && !(plan['also'] as number)) {
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

/** The colony sites again at once after a plan is sent back: a house for the homeless, or the
 * room a house needs. */
function chooseAgain(ctx: SystemContext, h: EntityRow, line: number): void {
  const green = greenOf(ctx.world);
  if (h['of']) growHouses(ctx, green, 1, h['of'] as number);
  else if (h['owner']) planHomes(ctx, green);
  else sitingHouse(ctx, green, () => planHouse(ctx, green, [line], 1));
}

/** Runs a round of house siting; if the town ring widened in it, the fields it now covers are
 * marked to leave (fieldlife.ts). */
function sitingHouse(ctx: SystemContext, green: Spot, siting: () => void): void {
  const before = ctx.state['ringLine'];
  siting();
  if (ctx.state['ringLine'] !== before) markLeaving(ctx, green, ctx.state['ringLine']!);
}

export { greenOf };

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
    ...['people.wantsHome', 'build.homeSited', 'build.hall'],
    'build.houseBuilt',
    'build.roomAdded',
    'build.grows',
    'build.growsPrivate',
    'build.growBlocked',
    'furniture.benchPlaced',
    'fire.planned',
    'fire.plannedCold',
    'fire.noFloor',
    'metal.smelterPlanned',
    'metal.clampPlanned',
    ...['town.ringWidened', 'field.needed', 'field.noGround', 'field.sited', 'field.sentBack'],
    ...['field.ripe', 'field.frostKilled', 'field.noSeed', 'field.sown', 'field.leftToGrass'],
    ...['field.rests', 'field.soil', 'field.muckReady', 'field.blight'],
    ...['build.storeSited', 'build.storeBuilt'],
    ...['pasture.needed', 'pasture.sited', 'pasture.sentBack', 'pasture.noGround', 'pasture.built'],
    ...['smithy.sited', 'smithy.noGround', 'smithy.built', 'smithy.sentBack'],
    ...['build.sickroom', 'build.burialSited', 'build.burialSentBack', 'build.middenSited'],
    ...['build.roadPlanned', 'build.roadLaid'],
  ],
  // `nobody`: the line saying nobody is able to build, while that holds; `green`: the green's
  // tile index plus one; `need`: the line saying people sleep in the open, while they do;
  // `noGround`: the alert that no ground near the green fits a house, while none does, and
  // `tried` the tick it last looked.
  // P4.7: `ring` the town ring's radius once widened (0 until then) and `ringLine` the line that
  // widened it; `fieldNeed`, `fieldNoGround` and `fieldTried` are `need`, `noGround` and `tried`
  // for fields.
  initialState: {
    ...{ nobody: 0, green: 0, need: 0, noGround: 0, tried: 0, ring: 0, ringLine: 0 },
    ...{ fieldNeed: 0, fieldNoGround: 0, fieldTried: 0, smithyNoGround: 0, smithyTried: 0 },
    ...{ pastureNeed: 0, pastureNoGround: 0, pastureTried: 0 },
    // 5B Bundle 1: the tick stores were first and last looked at (stores.ts).
    storeFrom: 0,
    storeTried: 0,
    // P5.14: the tick a home last found no ground, to look again a day later.
    homeTried: 0,
    // P5.10: the tick the colony last looked for a stretch of road to lay.
    roadTried: 0,
    // Phase 5B Bundle 2: the game day (1 + its index) the soil was last worked, and the loads of muck left.
    ...{ soilDay: 0, muck: 0 },
    // Blight: the game day it was last worked, the wet days of the last window as bits, and 1 if yesterday was dry.
    ...{ blightDay: 0, wetBits: 0, wasDry: 0 },
  },
  refs: [
    ...['nobody', 'need', 'noGround', 'ringLine', 'fieldNeed', 'fieldNoGround', 'smithyNoGround'],
    ...['pastureNeed', 'pastureNoGround'],
  ],
  tables: {
    ...BUILD_TABLES,
    ...HOUSE_TABLES,
    ...FURNITURE_TABLES,
    ...FIELD_TABLES,
    ...PASTURE_TABLES,
    ...SMITHY_TABLES,
    ...STATION_TABLES,
    ...BURIAL_TABLES,
    ...MIDDEN_TABLES,
    ...ROAD_TABLES,
    ...WELL_TABLES,
  },
  commands: {
    placeBuilding: (ctx, command, cause) => placeBuilding(ctx, command.data, cause),
    deconstruct: (ctx, command, cause) => deconstruct(ctx, command.data, cause),
    setBuild: (ctx, command, cause) => setBuild(ctx, command.data, cause),
    sendBack: (ctx, command, cause) =>
      command.data['pasture'] !== undefined
        ? sendBackPasture(ctx, command.data, cause, greenOf(ctx.world))
        : command.data['burial'] !== undefined
          ? sendBackBurial(ctx, command.data, cause, greenOf(ctx.world))
          : command.data['smithy'] !== undefined
            ? sendBackSmithy(ctx, command.data, cause, greenOf(ctx.world))
            : command.data['field'] !== undefined
              ? sendBackField(ctx, command.data, cause, greenOf(ctx.world))
              : sendBack(ctx, command.data, cause, (h, line) => chooseAgain(ctx, h, line)),
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
    if (!growHouses(ctx, green)) sitingHouse(ctx, green, () => planHouse(ctx, green, []));
    // P5.14: homes of their own, and the hall.
    planHomes(ctx, green);
    tickFields(ctx);
    planFields(ctx, green, []);
    // 5B Bundle 1: stores by kind from need.
    finishStores(ctx);
    planStores(ctx, green);
    finishPastures(ctx);
    planPasture(ctx, green, []);
    planBench(ctx);
    planSmithy(ctx, green);
    planRoomHearths(ctx);
    planWell(ctx, green);
    planStations(ctx, green);
    // P5.6, P5.8: a sickroom once enough lie hurt; a burial ground at the first death.
    planSickroom(ctx, green);
    planBurial(ctx, green);
    // P5.4a: a midden at the first offal.
    planMidden(ctx, green);
    // P5.10: a road on the most worn way, as stone allows.
    finishRoads(ctx);
    planRoads(ctx, green);
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
