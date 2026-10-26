// The mill as the page shows it (5B Bundle 4): its wheel on the map, turning or iced, and the mill's
// tile page: what it is, why it lies here, whether its wheel turns, where grinding goes on, the
// oven, who is at the work, and its one Send back. Every value is the engine's answer put into
// words; nothing here decides a rule (GAME-02). Pure reads, like works.ts.
import { content } from '../content/index.ts';
import {
  furnitureOf,
  isFrozen,
  millOf,
  millRefusal,
  partOf,
  plansOf,
  turning,
  WATER,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { GoodsView, WorksView } from './protocol-goods.ts';
import { doingOf, linesOf, type LineOf } from './works.ts';

const itemName = (kind: string): string => content.items.find((i) => i.id === kind)?.name ?? kind;
const at = (r: EntityRow, k: string): number => r[k] as number;

/** The mill's wheel on its water tile: faint while planned, turning (numbered frames) while its
 * water runs, hung with ice while it is frozen. */
export function millGoods(world: WorldState): GoodsView['furniture'] {
  const m = millOf(world);
  if (!m) return [];
  const wheel = at(m, 'wheel');
  const [x, y] = [wheel % world.map.width, Math.floor(wheel / world.map.width)];
  const iced = isFrozen(world.map, wheel);
  const art = iced ? 'furn.wheel.ice' : 'furn.wheel';
  return [{ x, y, z: 0, art, facing: 's', plan: m['state'] !== 'built' }];
}

function wheelWords(world: WorldState, m: EntityRow): string {
  const water = WATER[world.map.water[at(m, 'wheel')]!] ?? 'water';
  if (m['state'] !== 'built') return `in the ${water}; it turns once the mill stands`;
  return turning(world, m)
    ? `turning in the ${water}`
    : `iced over: the ${water} has frozen at the wheel, so it stands until the ice goes`;
}

function ovenWords(world: WorldState): string {
  const def = content.buildings.mill.bake.oven;
  const oven = furnitureOf(world).find((f) => f['kind'] === def.kind);
  if (oven) return oven['state'] === 'built' ? 'built beside the mill' : 'planned beside the mill';
  const days = (world.systems['build']?.['flourOver'] as number | undefined) ?? 0;
  return `none yet: one is planned once flour stands at its plate on ${def.days} days (${days} so far)`;
}

/** The mill's page, for any tile inside it or its wheel's tile. */
function millPage(world: WorldState, m: EntityRow, lineOf: LineOf): WorksView {
  const def = content.buildings.mill;
  const plans = plansOf(world).filter((p) => p['house'] === m.id);
  const stones = furnitureOf(world).find((f) => f.id === m['stones']);
  const parts = [...plans, ...(stones ? [stones] : [])];
  const done = parts.filter((p) => p['state'] === 'built').length;
  const mats = [...new Set(plans.map((p) => partOf(content, p['part'] as string)?.material))]
    .filter((k): k is string => !!k)
    .map(itemName);
  const grind = turning(world, m)
    ? `at the mill: ${def.wheel.rate} grain an hour against the quern's ${def.quern.rate}`
    : `at the quern, ${def.quern.rate} grain an hour, at most ${Math.round(def.quern.most / 6) / 10} hours a day`;
  const back = millRefusal(world, m) === '';
  return {
    name: 'Mill',
    rows: [
      [
        'what',
        `a water mill, ${at(m, 'w')} by ${at(m, 'h')} tiles: millstones inside, its wheel outside`,
      ],
      [
        'state',
        m['state'] === 'built' ? 'built' : `planned: ${done} of ${parts.length} parts built`,
      ],
      ['why here', `${String(m['why'])}.`],
      ['built of', mats.join(' and ')],
      ['wheel', wheelWords(world, m)],
      ['grinding', grind],
      ['oven', ovenWords(world)],
      ...(back
        ? []
        : m['sent']
          ? [['send back', 'used: the first site was sent back'] as [string, string]]
          : []),
    ],
    doing: doingOf(world, [def.job, def.bake.job]),
    lines: linesOf(world, lineOf, [
      ['Wheel · ', m['stood']],
      ['Built · ', m['built']],
      ['Planned · ', m['line']],
    ]),
    ...(back && { back: m.id }),
  };
}

/** The mill's page on surface tile (x, y): inside its walls or on its wheel. */
export function tileMill(
  world: WorldState,
  x: number,
  y: number,
  lineOf: LineOf,
): { works: WorksView } | undefined {
  const m = millOf(world);
  if (!m) return undefined;
  const inside =
    x >= at(m, 'x') &&
    x < at(m, 'x') + at(m, 'w') &&
    y >= at(m, 'y') &&
    y < at(m, 'y') + at(m, 'h');
  if (!inside && y * world.map.width + x !== at(m, 'wheel')) return undefined;
  return { works: millPage(world, m, lineOf) };
}
