// The item page (P4.6) and a person's tools (V-088): a tool or an ingot stack, where it came from
// and, for a tool, who holds it and why, how fast it works and how long it lasts. "Made from" walks
// the item's own `trail` back to the ore, so it still reads after the ledger's days are sealed.
// Every value is the engine's answer put into words; nothing here decides a rule. Pure reads.
import { content } from '../content/index.ts';
import {
  heldBy,
  itemsOf,
  lifeFor,
  recordOf,
  speedOf,
  toolOf,
  trailOf,
  type EntityRow,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { LedgerLine } from './protocol.ts';
import type { ItemStep, ItemView } from './protocol-goods.ts';
import { clockView } from './views.ts';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const itemName = (kind: string): string => content.items.find((i) => i.id === kind)?.name ?? kind;
const hours = (minutes: number): number => Math.ceil(minutes / 60);
/** "2 iron ingots", "1 tin ingot": the item names are plural. */
const counted = (n: number, name: string): string =>
  `${n} ${n === 1 ? name.replace(/s$/, '') : name}`;

/** "Day 3 of Goldmonth", or '' for a step with no time. */
function dateOf(tick: number): string {
  if (tick <= 0) return '';
  const c = clockView(tick);
  return `Day ${c.day} of ${c.monthName}`;
}

/** The tool's quality word, if it is not plain. */
const wordOf = (item: EntityRow): string => {
  const id = (item['quality'] as string) || 'plain';
  return id === 'plain'
    ? ''
    : (content.buildings.furniture.quality.find((q) => q.id === id)?.word ?? id);
};

/** "fine iron axe", "stone pick", or an ingot's name. */
function nameOf(item: EntityRow): string {
  const tool = toolOf(content, item);
  if (!tool) return itemName(item['kind'] as string);
  const kind = content.tools.kinds.find((k) => k.id === tool.kind)?.name ?? tool.kind;
  return [wordOf(item), content.tools.materials.find((m) => m.id === tool.material)?.name, kind]
    .filter(Boolean)
    .join(' ');
}

/** "Made from", the trail walked back from the last step: smelting and mixing first, what went
 * into them one notch in. Steps with no tile on record say so. */
function stepsOf(item: EntityRow): ItemStep[] {
  const out: ItemStep[] = [];
  let base = 0;
  for (const s of trailOf(item).reverse()) {
    if (s.s === 'made') continue;
    const when = dateOf(s.tick);
    const [who, k] = [s.who ? ` by ${s.who}` : '', s.k ?? ''];
    if (s.s === 'mined') {
      const ore = `${itemName(k) || 'ore'}, mined${who}`;
      const known = s.x !== undefined && s.y !== undefined && s.who !== '';
      const place = s.z ? `${s.z} level${s.z > 1 ? 's' : ''} down` : 'on the surface';
      out.push(
        known
          ? {
              depth: base + 1,
              text: `${ore}, ${place}, at `,
              tile: { x: s.x!, y: s.y!, z: s.z ?? 0, label: `tile ${s.x}, ${s.y}` },
              after: when && `, ${when}`,
            }
          : { depth: base + 1, text: `${ore}: ore tile not recorded${when && `, ${when}`}` },
      );
    } else if (s.s === 'burned') {
      const { logs, yield: per } = content.metal.clamp;
      const from = s.n ? ` from ${Math.ceil(s.n / per) * logs} logs` : '';
      out.push({ depth: base + 1, text: `charcoal, burned${who}${from}${when && `, ${when}`}` });
    } else {
      const r = content.metal.recipes.find((x) => x.makes === k);
      const runs = Math.max(1, Math.round((s.n ?? 1) / (r?.out ?? 1)));
      const from = r
        ? `, from ${r.inputs.map((i) => counted(i.count * runs, itemName(i.kind))).join(' and ')}`
        : '';
      const verb = s.s === 'mixed' ? 'mixed' : 'smelted';
      if (s.s === 'mixed') base = 0;
      out.push({
        depth: base,
        text: `${counted(s.n ?? 1, itemName(k))}, ${verb}${who}${when && `, ${when}`}${from}`,
      });
      if (s.s === 'mixed') base = 1;
    }
  }
  return out;
}

/** Whoever has worked with this kind of tool most this week (V-088), and how long. */
function usageOf(world: WorldState, kind: string): { person: number; minutes: number }[] {
  return (world.entities['usage'] ?? [])
    .filter((r) => r['kind'] === kind && (r['minutes'] as number) > 0)
    .map((r) => ({ person: r['person'] as number, minutes: r['minutes'] as number }))
    .sort((a, b) => b.minutes - a.minutes || a.person - b.person);
}

/** The facts of a tool: made by, held by and why, speed against a plain stone tool, wear left. */
function toolFacts(world: WorldState, item: EntityRow): [string, string][] {
  const tool = toolOf(content, item)!;
  const kind = content.tools.kinds.find((k) => k.id === tool.kind);
  const made = trailOf(item).find((s) => s.s === 'made');
  const word = wordOf(item) || 'plain';
  const stone = content.tools.materials.find((m) => m.id === 'stone')?.speed ?? 100;
  const diff = speedOf(content, item) - stone;
  const work =
    kind?.serves.flatMap(
      (id) => content.jobs.find((j) => j.id === id)?.name.toLowerCase() ?? [],
    )[0] ?? 'work';
  const used = usageOf(world, tool.kind);
  const owner = (world.entities['person'] ?? []).find((p) => p.id === item['owner']);
  const mine = used.find((u) => u.person === owner?.id);
  const top = used[0]?.person === owner?.id ? ', the most' : '';
  const own = mine
    ? `${hours(mine.minutes)} hours of ${work} this week${top}`
    : `no ${work} recorded this week`;
  const holder = owner
    ? `${owner['name'] as string}, ${own}`
    : 'nobody: it lies with the cart, free for whoever does the most work with it';
  const life = lifeFor(content, tool.material, (item['quality'] as string) || 'plain');
  return [
    [
      'made by',
      made ? `${made.who}, ${dateOf(made.tick)}: ${word}` : `came with the band's cart: ${word}`,
    ],
    ['held by', holder],
    [
      'work',
      diff
        ? `${Math.abs(diff)}% ${diff > 0 ? 'faster' : 'slower'} than a plain stone ${kind?.name ?? 'tool'}`
        : `as fast as a plain stone ${kind?.name ?? 'tool'}`,
    ],
    ['wear', `${hours(item['wear'] as number)} of ${hours(life)} hours left`],
  ];
}

/** The item page for item `id`, if it still exists. */
export function itemView(
  world: WorldState,
  id: number,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): ItemView | undefined {
  const item = itemsOf(world).find((i) => i.id === id);
  if (!item) return undefined;
  const tool = toolOf(content, item);
  const line = item['made'] as number;
  const made = line > 0 ? recordOf(world, line) : undefined;
  const count = item['count'] as number;
  return {
    id,
    name: cap(nameOf(item)) + (!tool && count > 1 ? ` × ${count}` : ''),
    facts: tool
      ? toolFacts(world, item)
      : [['kept', item['holder'] ? 'carried' : `${count} in the store`]],
    steps: stepsOf(item),
    ...(made && { made: lineOf(made) }),
  };
}

/** A person's tools for their sheet: each with the hours it has left. */
export function personTools(world: WorldState, person: number) {
  return heldBy(world, content, person).map((i) => {
    const kind = toolOf(content, i)!.kind;
    return { id: i.id, kind, text: `${nameOf(i)}, ${hours(i['wear'] as number)} hours left` };
  });
}
