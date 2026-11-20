// The sick-house from need (P6.5, V-144): while the Sickness law in force lays the catching-sick
// apart (a setting with `sick` `house`, laws.json) and someone has been sent to it (the bout's
// `sent`, care/apart.ts), the builders site a house of `health.sickhouse.size` within the town
// ring as far from the homes as the ground allows, with a line naming who. It is a house with
// `sick` 2: nobody claims its beds, it wants `health.sickhouse.beds` of them (wants.ts) and only
// those sent to it are laid there (care/care.ts). The build system reads the law and health
// tables; it imports nothing of either.
import { TICKS_PER_DAY, type EngineContent, type WorldState } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { dirFrom, placeHouse } from './houses.ts';
import { chooseHouse, housesOf, rectOf } from './site.ts';

/** Whether the law in force lays the catching-sick in a sick-house. */
function wantsSickHouse(world: WorldState, content: EngineContent): boolean {
  return content.laws.laws.some((l) => {
    const set = (world.entities['law'] ?? []).find((r) => r['law'] === l.id)?.['setting'];
    return l.settings.find((s) => s.id === (set ?? l.start))?.sick === 'house';
  });
}

/** Each hour: someone is sent to a sick-house and there is none, so the builders site one; with no
 * ground for it they look again the next day. */
export function planSickHouse(ctx: SystemContext, green: Spot): void {
  const { world, content, state } = ctx;
  if (housesOf(world).some((h) => h['sick'] === 2 && h['state'] !== 'sent')) return;
  if (!wantsSickHouse(world, content)) return;
  // Someone sent to it and here: not someone sent away under an earlier setting.
  const people = (world.entities['person'] ?? []).filter((q) => q['status'] === 'alive');
  const bout = (world.entities['ill'] ?? []).find(
    (r) => r['state'] === 'sick' && r['sent'] && people.some((q) => q.id === r['person']),
  );
  const p = bout && people.find((q) => q.id === bout['person']);
  if (!bout || !p) return;
  if (world.tick < (state['sickTried'] ?? -TICKS_PER_DAY) + TICKS_PER_DAY) return;
  state['sickTried'] = world.tick;
  const size = content.buildings.house.sizes.find((s) => s.id === content.health.sickhouse.size);
  const homes = housesOf(world)
    .filter((h) => !h['of'] && !h['sick'] && !h['inn'] && h['state'] !== 'sent')
    .map((h) => {
      const r = rectOf(h);
      return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), z: 0 };
    });
  const pick =
    size &&
    chooseHouse(world, content, green, size.sleeps, undefined, {
      sizes: [size],
      apart: homes,
    });
  if (!pick) return;
  const ill = content.health.ills.find((d) => d.id === bout['ill'])?.name ?? 'a sickness';
  const far = Math.min(
    ...homes.map((s) =>
      Math.max(
        Math.max(pick.site.x - s.x, s.x - (pick.site.x + pick.site.w - 1), 0),
        Math.max(pick.site.y - s.y, s.y - (pick.site.y + pick.site.h - 1), 0),
      ),
    ),
  );
  const line = ctx.emit('build.sickHouse', {
    causes: [bout['sent'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      ill,
      size: pick.size.name,
      dir: dirFrom(green, pick.site),
      far: Number.isFinite(far) ? far : 0,
      why: pick.why,
    },
  });
  const id = placeHouse(ctx, pick.site, pick.size, pick.wall, line, {
    why: `as far from the homes as the ground allows, for the catching-sick; ${pick.why}`,
  });
  housesOf(world).find((h) => h.id === id)!['sick'] = 2;
}
