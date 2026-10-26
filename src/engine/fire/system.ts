// The fire system (P3.6): each hour a lit fire burns its fuel, a banked one unbanks at dawn, and
// one that runs out goes out with a line citing why. Who lights, feeds and banks fires is the
// people's (people/tend.ts, people/mind.ts); a hearth is planned by the build system (build/hearths.ts).
import { clockAt, type EntityRow } from '../core/index.ts';
import { freeTile, inStore, itemsOf, layItem, stackSize, stockOf, wantOf } from '../goods/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { FIRE_TABLES, firesOf, fuelOf, pieceOfFire, placeOf, timeWords } from './fire.ts';

/** Ash (V-135): a fire that has burned `ash.every` minutes lays one ash on the nearest free tile
 * beside its hearth (onto a pile of ash there with room first), else on the hearth's own tile. */
function layAsh(ctx: SystemContext, f: EntityRow, piece: EntityRow, burned: number): void {
  const { world, content } = ctx;
  const { item, every } = content.lamp.ash;
  f['ash'] = (f['ash'] as number) + burned;
  const [x, y, z] = [piece['x'] as number, piece['y'] as number, piece['z'] as number];
  while ((f['ash'] as number) >= every) {
    f['ash'] = (f['ash'] as number) - every;
    const near = (i: EntityRow) =>
      i['z'] === z &&
      Math.max(Math.abs((i['x'] as number) - x), Math.abs((i['y'] as number) - y)) <= 3;
    const pile = itemsOf(world).find(
      (i) =>
        i['kind'] === item &&
        !i['holder'] &&
        near(i) &&
        !inStore(world, i['x'] as number, i['y'] as number, z) &&
        (i['count'] as number) < stackSize(content, item),
    );
    if (pile) {
      pile['count'] = (pile['count'] as number) + 1;
      continue;
    }
    let at = { x, y };
    search: for (let r = 1; r <= 3; r += 1)
      for (let dy = -r; dy <= r; dy += 1)
        for (let dx = -r; dx <= r; dx += 1)
          if (
            Math.max(Math.abs(dx), Math.abs(dy)) === r &&
            z === 0 &&
            freeTile(world, content, x + dx, y + dy)
          ) {
            at = { x: x + dx, y: y + dy };
            break search;
          }
    layItem(world, { kind: item, count: 1, ...at, z, made: f['line'] as number });
  }
}

function runFires(ctx: SystemContext): void {
  const { world, content } = ctx;
  const hour = clockAt(world.tick, content.calendar).hour;
  // Dawn is when the colony's work starts (content's `work.hours`).
  const dawn = content.work.hours.from;
  for (const f of firesOf(world)) {
    if (!f['lit']) continue;
    const piece = pieceOfFire(world, f);
    if (f['banked'] && hour === dawn) {
      f['banked'] = 0;
      f['line'] = ctx.emit('fire.unbanked', {
        causes: [f['line'] as number],
        data: { where: placeOf(world, content, piece).where },
      });
    }
    const fuel = fuelOf(content, f['kind'] as string);
    const rate = f['banked'] && fuel ? fuel.banked.rate : 1;
    const burned = Math.min(f['fuel'] as number, Math.floor(60 / rate));
    f['fuel'] = (f['fuel'] as number) - burned;
    layAsh(ctx, f, piece, burned);
    if (f['fuel']) continue;
    // Out: the empty Firewood plate when the colony wants none, else the last tend.
    const item = fuel?.item ?? '';
    const plate = stockOf(world, item);
    const none = !!plate && wantOf(world, content, item) === 0;
    const idle = world.tick - (f['used'] as number) >= content.work.fire.tend.idle;
    const here = placeOf(world, content, piece);
    const name = content.items.find((i) => i.id === item)?.name ?? 'fuel';
    const why = idle
      ? `nobody has used the ${here.indoors ? 'room' : 'fire'} since ${timeWords(content, f['used'] as number)}`
      : `it ran out of ${name}${none ? `, and the colony wants none` : ''}`;
    f['lit'] = 0;
    f['banked'] = 0;
    f['line'] = ctx.emit('fire.out', {
      causes: [none ? (plate!['line'] as number) : (f['line'] as number)],
      data: { where: here.where, why },
    });
  }
}

export const fireSystem: System = {
  id: 'fire',
  every: 'hour',
  emits: ['fire.out', 'fire.unbanked'],
  tables: FIRE_TABLES,
  run: runFires,
};
