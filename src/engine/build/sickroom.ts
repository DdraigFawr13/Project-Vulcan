// The sickroom from need (P5.6, V-061's pattern): once `health.sickroom.hurt` people lie hurt at
// once, the colony adds a room (content `house.stage`) to its first cottage, on its flattest
// side and in its own wall material, with a line naming them; it wants `health.sickroom.beds`
// beds (wants.ts) and nobody claims one (people/claim.ts). The hurt are carried to a free one
// first (people/care.ts). The build system reads the health tables; it imports nothing of health.
import type { EntityRow, WorldState } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { stageSite } from './grow.ts';
import { placeHouse, rowsOf, sizeOf } from './houses.ts';
import { partOf } from './plans.ts';
import { housesOf, inRect, rectOf } from './site.ts';

const list = (names: readonly string[]): string =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** The people alive and lying hurt now. */
function lyingHurt(world: WorldState): EntityRow[] {
  const down = new Set(
    (world.entities['body'] ?? []).filter((b) => b['down']).map((b) => b['person']),
  );
  return (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive' && down.has(p.id));
}

/** Each hour: enough lie hurt and there is no sickroom, so the first cottage gets one. */
export function planSickroom(ctx: SystemContext, green: Spot): void {
  const { world, content } = ctx;
  const hurt = lyingHurt(world);
  if (hurt.length < content.health.sickroom.hurt) return;
  if (housesOf(world).some((h) => h['sick'] && h['state'] !== 'sent')) return;
  const main = housesOf(world).find((h) => !h['of'] && h['state'] === 'built');
  if (!main) return;
  const site = stageSite(ctx, main, green);
  if (!site) return;
  const lines = hurt.map((p) =>
    Math.max(
      0,
      ...(world.entities['wound'] ?? [])
        .filter((w) => w['person'] === p.id && w['state'] === 'open')
        .map((w) => w['line'] as number),
    ),
  );
  const size = sizeOf(content, main).name;
  const line = ctx.emit('build.sickroom', {
    causes: lines.filter((l) => l > 0).sort((a, b) => a - b),
    actors: hurt.map((p) => p.id),
    data: { names: list(hurt.map((p) => p['name'] as string)), size },
  });
  const rows = rowsOf(world, main);
  const id = placeHouse(
    ctx,
    site,
    content.buildings.house.stage,
    partOf(content, main['wall'] as string)!,
    line,
    {
      why: `the flattest side of the ${size}, for the hurt`,
      of: main.id,
      skip: (x, y) => rows.some((h) => inRect(rectOf(h), x, y)),
    },
  );
  housesOf(world).find((h) => h.id === id)!['sick'] = 1;
}
