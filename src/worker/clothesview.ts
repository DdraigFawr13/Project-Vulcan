// What people wear and what the colony holds in spare, as the sheets show it (Phase 5B Bundle 5,
// V-092, V-134): the person sheet's Wearing rows and the Stock sheet's Clothes lines. Pure reads
// of the world; every word and number is made here (GAME-02).
import { content } from '../content/index.ts';
import {
  garmentOf,
  haveOf,
  leftOf,
  recordOf,
  sparesOf,
  wornOf,
  type EntityRow,
  type SimEvent,
  type WorldState,
} from '../engine/index.ts';
import type { ClothesPlate, WearingRow } from './protocol-people.ts';

const nameOf = (kind: string): string => content.items.find((i) => i.id === kind)?.name ?? kind;
const cap = (s: string): string => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
const worthWord = (id: unknown): string =>
  content.clothes.worth.find((w) => w.id === id)?.word ?? String(id);

/** Who made a garment: the first actor of its `clothes.made` line, else "came with them" (the
 * cart and newcomers, whose `made` is the arrival line). */
function makerOf(world: WorldState, item: EntityRow): { by: string; why?: number } {
  const line = item['made'] as number;
  const e = line > 0 ? recordOf(world, line) : undefined;
  const actor = e && e.type === 'clothes.made' ? (e as SimEvent).actors[0] : undefined;
  const name = (world.entities['person'] ?? []).find((q) => q.id === actor)?.['name'] as
    string | undefined;
  return name ? { by: `by ${name}`, why: line } : { by: 'came with them' };
}

/** One row per garment worn, in slot order: "Everyday", "Wool tunic, good", and its second line
 * "by Eadgyth · worn 40% · warms 2°" (an outer layer: "warms 4° outdoors"). */
export function wearingRows(world: WorldState, p: EntityRow): WearingRow[] {
  const worn = wornOf(world, p.id);
  return content.clothes.slots.flatMap((slot, k) => {
    const item = worn.find((i) => garmentOf(content, i['kind'] as string)?.slot === slot.id);
    if (!item) return [];
    const warms = garmentOf(content, item['kind'] as string)?.warmth ?? 0;
    const maker = makerOf(world, item);
    return [
      {
        slot: slot.name,
        text: `${cap(nameOf(item['kind'] as string))}, ${worthWord(item['quality'])}`,
        detail: `${maker.by} · worn ${100 - leftOf(content, item)}% · warms ${warms}°${k > 0 ? ' outdoors' : ''}`,
        ...(maker.why !== undefined && { why: maker.why }),
      },
    ];
  });
}

/** "1 linen smock, 2 wool cloaks" for the spares of a slot; "none" without. */
function sparesLine(world: WorldState, slot: string): string {
  const counts = new Map<string, number>();
  for (const i of sparesOf(world, content, slot))
    counts.set(i['kind'] as string, (counts.get(i['kind'] as string) ?? 0) + 1);
  if (!counts.size) return 'none';
  return [...counts].map(([kind, n]) => `${n} ${nameOf(kind)}${n > 1 ? 's' : ''}`).join(', ');
}

/** The Clothes plate's read-only lines: spares by slot, and what the colony holds to make more. */
export function clothesPlate(world: WorldState): ClothesPlate {
  const mats = ['wool', 'linen', 'leather', 'fur', 'fleece', 'hide', 'flax'];
  return {
    slots: content.clothes.slots.map((s) => ({
      name: s.name.toLowerCase(),
      text: sparesLine(world, s.id),
    })),
    making: mats.map((k) => `${haveOf(world, content, k)} ${nameOf(k)}`).join(', '),
  };
}
