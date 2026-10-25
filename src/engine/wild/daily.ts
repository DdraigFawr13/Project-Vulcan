// A day in the wild valley (V-110, V-111), at midnight after the weather: the snow takes a few
// animals, the pack eats beyond the valley or among the herds or goes hungry, a herd that falls to
// half its start is named, and on a month's first day the herds breed and gain strays. The pack
// leaves when too few are left, and a new one may come on the first day of Thawmonth.
import { clockAt, type EntityRow } from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { gameWords, valleyGame, valleyName, whereWords } from './ground.ts';
import { settlePack } from './place.ts';
import { sweepPrints } from './prints.ts';
import { animalsOf, herdsOf, membersOf, packRow, speciesOf, wildHerdsOf } from './wild.ts';

/** Writes `wild.herdLow` the first time a herd is at or under `wild.low` per cent of its start,
 * citing its latest cause, and forgets it once the herd has recovered. */
export function checkLow(ctx: SystemContext, herd: EntityRow): void {
  const { world, content } = ctx;
  if (herd['kept']) return;
  const now = membersOf(world, herd.id).length;
  const low = now * 100 <= (herd['start'] as number) * content.wild.low;
  if (!low) {
    herd['low'] = 0;
    return;
  }
  if (herd['low']) return;
  const sp = speciesOf(content, herd['species'] as string);
  herd['low'] = herd['line'] = ctx.emit('wild.herdLow', {
    causes: [herd['line'] as number],
    data: {
      species: sp.plural,
      where: whereWords(world, content, herd['x'] as number, herd['y'] as number),
      ...{ now, start: herd['start'] as number, taken: herd['taken'] as number },
      pack: herd['byPack'] as number,
      snow: herd['bySnow'] as number,
    },
  });
}

/** Snow takes an animal now and then: each on a snow-lying tile, with the species' loss scaled by
 * how full its herd is. */
function snowLoss(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (!world.systems['weather']?.['snowTiles']) return;
  const rng = ctx.rng();
  const map = world.map;
  const weather = world.systems['weather'];
  for (const herd of wildHerdsOf(world)) {
    const sp = speciesOf(content, herd['species'] as string);
    const members = membersOf(world, herd.id);
    const chance = (content.wild.snowLoss * members.length) / sp.cap;
    let dead = 0;
    for (const a of members)
      if (map.snowLie[(a['y'] as number) * map.width + (a['x'] as number)] && rng.chance(chance)) {
        removeEntity(world, 'animal', a.id);
        dead += 1;
      }
    if (!dead) continue;
    herd['lost'] = (herd['lost'] as number) + dead;
    herd['bySnow'] = (herd['bySnow'] as number) + dead;
    herd['line'] = weather['snowLine'] || weather['spell']!;
    checkLow(ctx, herd);
  }
}

/** The first day of a month: births in a species' breeding months, and a stray to each herd under
 * its start outside winter. These are state only; the herd's size shows in its inspector. */
function monthly(ctx: SystemContext, month: string): void {
  const { world, content } = ctx;
  const rng = ctx.rng();
  const winter = content.wild.winter.includes(month);
  for (const herd of wildHerdsOf(world)) {
    const sp = speciesOf(content, herd['species'] as string);
    const members = membersOf(world, herd.id);
    if (!members.length) continue;
    let gain = 0;
    if (sp.breed.months.includes(month)) {
      const expected = (members.length * sp.breed.rate) / sp.breed.months.length;
      gain += Math.floor(expected) + (rng.chance(expected - Math.floor(expected)) ? 1 : 0);
    }
    if (!winter && members.length < (herd['start'] as number)) gain += 1;
    gain = Math.min(gain, sp.cap - members.length);
    for (let k = 0; k < gain; k += 1) {
      const kind = sp.kinds[(members.length + k) % sp.kinds.length]!;
      const from = rng.pick(members);
      addEntity(world, 'animal', {
        ...{ herd: herd.id, pack: 0, kind, x: from['x'] as number, y: from['y'] as number },
        ...{
          z: 0,
          path: [],
          stride: 0,
          facing: from['facing'] as string,
          state: '',
          until: 0,
          hurt: 0,
        },
        ...{ sex: '', born: 0, young: 0, tamedBy: 0, cull: 0, shorn: 0, dies: 0 },
      });
    }
    if (gain) checkLow(ctx, herd);
  }
}

/** The pack's day: it leaves or returns, eats or goes hungrier, and says so at the set days. */
function packDay(ctx: SystemContext, month: string, first: boolean): void {
  const { world, content } = ctx;
  const row = packRow(world);
  if (!row) return;
  const dials = content.wild.pack;
  if (!row['size']) {
    if (first && month === dials.returns.month && ctx.rng().chance(dials.returns.chance)) {
      const reach = reachFrom(content, world.map, {
        x: world.map.startX,
        y: world.map.startY,
        z: 0,
      });
      settlePack(ctx, reach, row['line'] as number);
    }
    return;
  }
  const members = animalsOf(world).filter((a) => a['pack'] === row.id);
  row['size'] = members.length;
  const pred = content.wild.predators.find((p) => p.kind === row['species'])!;
  if (members.length < Math.min(dials.least, pred.size[0]!)) {
    for (const a of members) removeEntity(world, 'animal', a.id);
    row['size'] = 0;
    row['visiting'] = 0;
    row['line'] = ctx.emit('wild.packLeft', {
      causes: [row['line'] as number],
      data: { name: row['name'] as string, why: members.length ? dials.left.few : dials.left.dead },
    });
    return;
  }
  const rng = ctx.rng();
  const winter = content.wild.winter.includes(month);
  const harsh = content.weather[world.systems['weather']?.['kind'] ?? 0]?.id === dials.harsh;
  const off = (winter ? dials.offMapWinter : dials.offMap) * (harsh ? dials.harshFactor : 1);
  let fed = rng.chance(off);
  if (!fed) {
    const open = world.systems['wild']!['open']!;
    const snowy = (world.systems['weather']?.['snowTiles'] ?? 0) * 100 >= open * dials.snowMost;
    const game = Math.min(1, valleyGame(world, content) / dials.gameFull);
    fed = rng.chance(dials.inValley * game * (snowy ? dials.snowFactor : 1)) && packKill(ctx, row);
  }
  if (fed) {
    Object.assign(row, { hunger: 0, lastKill: world.tick });
    return;
  }
  row['hunger'] = (row['hunger'] as number) + 1;
  const days = row['hunger'] as number;
  if (days >= dials.hungry && (days - dials.hungry) % dials.hungryEvery === 0)
    hungry(ctx, row, harsh, winter);
}

/** The pack pulls down one animal of the largest herd; false when no herd is left. */
function packKill(ctx: SystemContext, row: EntityRow): boolean {
  const { world, content } = ctx;
  const rng = ctx.rng();
  const sizes = wildHerdsOf(world).map((h) => [h, membersOf(world, h.id)] as const);
  const herds = sizes.filter(([, m]) => m.length).sort((a, b) => b[1].length - a[1].length);
  if (!herds.length) return false;
  const [herd, members] = herds[0]!;
  const prey = rng.pick(members);
  const sp = speciesOf(content, herd['species'] as string);
  removeEntity(world, 'animal', prey.id);
  herd['lost'] = (herd['lost'] as number) + 1;
  herd['byPack'] = (herd['byPack'] as number) + 1;
  const line = ctx.emit('wild.packKilled', {
    causes: [herd['line'] as number],
    data: {
      name: row['name'] as string,
      a: 'a',
      species: sp.name,
      where: whereWords(world, content, prey['x'] as number, prey['y'] as number),
    },
  });
  herd['line'] = row['line'] = line;
  checkLow(ctx, herd);
  return true;
}

/** `wild.packHungry`: how long, what game is left, and why, citing the scarcest low herd's line,
 * else the weather spell. */
function hungry(ctx: SystemContext, row: EntityRow, harsh: boolean, winter: boolean): void {
  const { world, content } = ctx;
  const dials = content.wild.pack;
  const lows = herdsOf(world)
    .filter((h) => h['low'])
    .map((h) => [h, membersOf(world, h.id).length / (h['start'] as number)] as const)
    .sort((a, b) => a[1] - b[1] || a[0].id - b[0].id);
  const scarce = lows[0]?.[0];
  const game = gameWords(world, content);
  let left = game
    ? `Only ${game} are left in ${valleyName(world, content)}`
    : `No game is left in ${valleyName(world, content)}`;
  if (scarce) {
    const sp = speciesOf(content, scarce['species'] as string);
    left = `The ${sp.plural} ${whereWords(world, content, scarce['x'] as number, scarce['y'] as number)} are down to ${membersOf(world, scarce.id).length}`;
  }
  row['hungryLine'] = row['line'] = ctx.emit('wild.packHungry', {
    causes: [scarce ? (scarce['low'] as number) : world.systems['weather']!['spell']!],
    data: {
      name: row['name'] as string,
      days: row['hunger'] as number,
      left,
      why: harsh ? dials.why.harsh : winter ? dials.why.winter : dials.why.other,
    },
  });
}

/** Midnight, after the weather. */
export function dailyWild(ctx: SystemContext): void {
  const { world, content } = ctx;
  const clock = clockAt(world.tick, content.calendar);
  const month = content.calendar.monthNames[clock.month]!;
  const first = clock.day === 1;
  if (first && clock.month === 0)
    for (const h of herdsOf(world)) Object.assign(h, { taken: 0, lost: 0, byPack: 0, bySnow: 0 });
  sweepPrints(ctx);
  snowLoss(ctx);
  if (first) monthly(ctx, month);
  packDay(ctx, month, first);
}
