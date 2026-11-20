// A child left in the valley (P6.1 part 2, Morgan's call): a stranger who came for hunger,
// sickness, war or a feud (family.json `left.kinds`) may, while they wait at the green, leave a
// child they cannot keep; kin.ts sees them taken in. Weighed once a stranger, on the family's
// own stream, so no other draw moves. Nobody asks for it: there is no lever (V-041).
import { yearNow, type EntityRow, type RngStream } from '../core/index.ts';
import { addPerson, drawChild } from '../band/index.ts';
import { people, personOf } from '../entity/index.ts';
import { layItem } from '../goods/index.ts';
import { seedPerson } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';

const SMITHING_NONE = { level: 0, potential: 0 };

/** The stranger's child: drawn from them as a child born here is, `ages` years old. */
function leave(ctx: SystemContext, rng: RngStream, s: EntityRow): void {
  const { world, content } = ctx;
  const [lo, hi] = content.family.left.ages as [number, number];
  const taken = people(world).map((p) => p['name'] as string);
  const { person } = drawChild(rng, content, [s, s], taken);
  const age = lo + rng.int(hi - lo + 1);
  const home = {
    name: s['home'] as string,
    culture: person.culture,
    days: s['homeDays'] as number,
  };
  const at = { x: s['x'] as number, y: s['y'] as number };
  const id = addPerson(
    world,
    content,
    { ...person, age, home: { ...home, dir: s['homeDir'] as string } },
    { ...at, status: 'alive', arrived: 0, born: yearNow(world, content) - age, rest: 0 },
    SMITHING_NONE,
  );
  const w = content.family.words;
  const line = ctx.emit('family.left', {
    causes: [s['stranger'] as number],
    actors: [id, s.id],
    data: {
      stranger: s['name'] as string,
      child: person.sex === 'f' ? w.daughter : w.son,
      name: person.name,
      age,
    },
  });
  const child = personOf(world, id)!;
  Object.assign(child, { arrived: line, left: line });
  seedPerson(world, content, child);
  layItem(
    world,
    { kind: content.life.cart.bedroll, count: 1, ...at, z: 0, made: line },
    { owner: id, state: 'laid' },
  );
}

/** Each day: each stranger at the green, not yet weighed, who came for one of `left.kinds`. */
export function leftDay(ctx: SystemContext): void {
  const { world, content } = ctx;
  const left = content.family.left;
  const rng = ctx.rng();
  const waiting = people(world).filter(
    (p) => p['status'] === 'stranger' && p['stranger'] && !p['weighed'],
  );
  for (const s of waiting) {
    s['weighed'] = 1;
    // One of a couple speaks for both.
    if (s['partner'] && (s['partner'] as number) < s.id) continue;
    if (!left.kinds.includes(s['reason'] as string)) continue;
    if (rng.int(100) < left.percent) leave(ctx, rng, s);
  }
}
