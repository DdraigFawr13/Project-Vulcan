// The metal works as the page shows them (Bundle 3): the smelter, the charcoal clamp and the smithy
// on the map and on their tile pages, and which Work rows exist yet (V-071). Every value is the
// engine's answer put into words; nothing here decides a rule. Pure reads, like furniture.ts.
import { content } from '../content/index.ts';
import {
  dirFrom,
  greenOf,
  haveOf,
  houseAt,
  piecesOf,
  recordOf,
  smithiesOf,
  stationAt,
  stationsOf,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import { nowOf } from './people.ts';
import type { LedgerLine } from './protocol.ts';
import type { GoodsView, WorksView } from './protocol-goods.ts';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const itemName = (kind: string): string => content.items.find((i) => i.id === kind)?.name ?? kind;
const inRect = (r: EntityRow, x: number, y: number): boolean =>
  x >= (r['x'] as number) &&
  x < (r['x'] as number) + (r['w'] as number) &&
  y >= (r['y'] as number) &&
  y < (r['y'] as number) + (r['h'] as number);

/** The smelter and the clamp for the map: the smelter faint until built, the clamp's four tiles as
 * quadrants (`nw`, `ne`, `sw`, `se`), faint while cold and smoking (numbered frames) while lit. */
export function stationGoods(world: WorldState): GoodsView['furniture'] {
  return stationsOf(world).flatMap((s) => {
    const [x, y, z] = [s['x'] as number, s['y'] as number, s['z'] as number];
    // The tan pits: a row of pits along the block's middle, a working space round them.
    if (s['kind'] === 'pits')
      return Array.from({ length: (s['w'] as number) - 1 }, (_, dx) => ({
        ...{ x: x + dx, y: y + ((s['h'] as number) >> 1), z },
        ...{ art: 'furn.pits', facing: 's', plan: s['state'] !== 'built' },
      }));
    if (s['kind'] === 'smelter')
      return [{ x, y, z, art: 'furn.smelter', facing: 's', plan: s['state'] !== 'built' }];
    const lit = s['state'] === 'lit';
    const out: GoodsView['furniture'] = [];
    for (let dy = 0; dy < (s['h'] as number); dy += 1)
      for (let dx = 0; dx < (s['w'] as number); dx += 1)
        out.push({
          ...{ x: x + dx, y: y + dy, z, plan: !lit },
          ...{
            art: lit ? 'furn.clamp.lit' : 'furn.clamp',
            facing: `${dy ? 's' : 'n'}${dx ? 'e' : 'w'}`,
          },
        });
    return out;
  });
}

/** The reason a station was sited, from the planning line's own words while it is held; once its
 * day is sealed the line is a stub, so it says where the station lies instead. */
function whyHere(world: WorldState, s: EntityRow): string {
  const e = recordOf(world, s['line'] as number);
  if (e && 'data' in e) return `${cap(String(e.data['why']))}. It lies ${String(e.data['where'])}.`;
  const dir = dirFrom(greenOf(world), { x: s['x'] as number, y: s['y'] as number, w: 1, h: 1 });
  return `It lies ${dir} of the green, just past the town ring. The line that sited it is an older record.`;
}

/** The person at a kind of work and what they are doing now, in the Work sheet's words. */
function doingOf(world: WorldState, jobs: string[]): WorksView['doing'] {
  const p = (world.entities['person'] ?? []).find((q) => jobs.includes(q['job'] as string));
  if (!p) return undefined;
  const now = nowOf(world, p);
  return {
    who: p['name'] as string,
    text: now.text,
    ...(now.why !== undefined && { why: now.why }),
  };
}

const recipesText = (): string =>
  content.metal.recipes
    .map((r) => {
      const from = r.inputs.map((i) => `${i.count} ${itemName(i.kind)}`).join(' and ');
      return `${itemName(r.makes)}: ${from} make ${r.out}`;
    })
    .join('; ');

type LineOf = (e: SimEvent | Stub) => LedgerLine;

/** The page's labelled lines, those that still exist, once each. */
function linesOf(
  world: WorldState,
  lineOf: LineOf,
  pairs: [string, unknown][],
): WorksView['lines'] {
  const seen = new Set<number>();
  return pairs.flatMap(([label, id]) => {
    const e = typeof id === 'number' && id > 0 ? recordOf(world, id) : undefined;
    if (!e || seen.has(e.id)) return [];
    seen.add(e.id);
    return [{ label, line: lineOf(e) }];
  });
}

function smelterPage(world: WorldState, s: EntityRow, lineOf: LineOf): WorksView {
  const def = content.metal.smelter;
  const reach = [...new Set(content.metal.recipes.flatMap((r) => r.inputs.map((i) => i.kind)))]
    .map((k) => `${itemName(k)} ${haveOf(world, content, k)}`)
    .join(', ');
  const built = s['state'] === 'built';
  return {
    name: 'Smelter',
    rows: [
      ['what', 'a stone furnace with hand bellows; the smelter works the bellows while it burns'],
      ['state', built ? 'built' : `planned: ${s['have'] as number} of ${def.cost} stone here`],
      ['why here', whyHere(world, s)],
      ['makes', recipesText()],
      ['in the store', reach],
    ],
    ...(built || s['work'] !== -1 ? { doing: doingOf(world, ['smelt', 'station']) } : {}),
    lines: linesOf(world, lineOf, [
      ['Waiting · ', s['alert']],
      ['Built · ', s['made']],
      ['Planned · ', s['line']],
    ]),
  };
}

function clampPage(world: WorldState, s: EntityRow, lineOf: LineOf): WorksView {
  const def = content.metal.clamp;
  const lit = s['state'] === 'lit';
  const left = Math.max(0, (s['lit'] as number) + def.burn - world.tick);
  return {
    name: 'Charcoal clamp',
    rows: [
      ['what', `a clamp of ${def.logs} logs under earth, burned slowly into ${def.yield} charcoal`],
      [
        'state',
        lit ? `burning, about ${Math.ceil(left / 60)} hours left` : 'cold, ready for a stack',
      ],
      ['why here', whyHere(world, s)],
    ],
    doing: doingOf(world, ['charcoal']),
    lines: linesOf(world, lineOf, [
      ['Lit · ', s['litLine']],
      ['Planned · ', s['line']],
    ]),
  };
}

function smithyPage(world: WorldState, s: EntityRow, lineOf: LineOf): WorksView {
  const def = content.buildings.smithy;
  const furniture = content.buildings.furniture.kinds.filter((k) => def.pieces.includes(k.id));
  const floor = content.buildings.parts.find((p) => p.id === def.floor);
  const byMaterial = new Map<string, string[]>();
  for (const [name, material] of [
    ...(floor ? [['floor', floor.material]] : []),
    ...furniture.map((k) => [k.name, k.material ?? content.buildings.furniture.material]),
  ] as [string, string][])
    byMaterial.set(material, [...(byMaterial.get(material) ?? []), name]);
  const builtOf = (kind: string) =>
    piecesOf(world, kind).some(
      (f) => f['state'] === 'built' && inRect(s, f['x'] as number, f['y'] as number),
    );
  const done = def.pieces.filter(builtOf).length;
  const state =
    s['state'] === 'built' ? 'built' : `planned: ${done} of ${def.pieces.length} pieces built`;
  return {
    name: 'Smithy',
    rows: [
      [
        'what',
        `an open-sided smithy, ${s['w'] as number} by ${s['h'] as number} tiles: ${furniture.map((k) => k.name).join(', ')}`,
      ],
      ['state', state],
      ['why here', `${cap(s['why'] as string)}.`],
      [
        'built of',
        [...byMaterial]
          .map(([m, names]) => `${itemName(m)} for the ${names.join(', ')}`)
          .join('; '),
      ],
    ],
    doing: doingOf(world, ['smith']),
    lines: linesOf(world, lineOf, [
      ['Built · ', s['built']],
      ['Planned · ', s['line']],
    ]),
  };
}

/** The smelter, clamp or smithy on surface tile (x, y), for the tile page. */
export function tileWorks(
  world: WorldState,
  x: number,
  y: number,
  lineOf: LineOf,
): { works: WorksView } | undefined {
  const smithy = smithiesOf(world).find(
    (s) => s['state'] !== 'sent' && inRect(s, x, y) && !houseAt(world, x, y),
  );
  if (smithy) return { works: smithyPage(world, smithy, lineOf) };
  const station = stationAt(world, x, y);
  if (!station || station['kind'] === 'pits') return undefined;
  return {
    works: (station['kind'] === 'clamp' ? clampPage : smelterPage)(world, station, lineOf),
  };
}
