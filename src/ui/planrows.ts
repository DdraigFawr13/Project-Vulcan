// A tile's plan or built part on the tile page (P3.1, P3.2): what it is, how much material has
// been brought, who is on it and what it does to the way, then the lines behind it.
import type { LedgerLine, TileView } from '../worker/index.ts';

const STATES: Record<string, string> = {
  plan: 'planned',
  built: 'built',
  down: 'to come down',
};

const PATHS: Record<string, string> = {
  wall: 'blocks the way',
  door: 'people pass through',
  floor: 'people walk on it',
  stair: 'a way down',
};

/** The tile page's rows for a plan or built part: key and value. A tile in a house adds its roof
 * and, once built, its room, beds and warmth (P3.7, P3.3); the worker puts each in words. */
export function planFacts(tile: TileView): [string, string][] {
  const { plan, house, room } = tile;
  if (!plan) return [];
  const kind = plan.part.split('-')[0]!;
  const built = plan.state === 'built';
  const what = `${plan.name}, ${STATES[plan.state] ?? plan.state}`;
  const rows: [string, string][] = [
    [built ? 'built' : 'plan', house && !built ? `${house.name}: ${what}` : what],
  ];
  if (!built) rows.push([plan.good, `${plan.have} of ${plan.cost} here`]);
  if (plan.builder) rows.push(['builder', `${plan.builder}, ${plan.doing ?? 'on it'}`]);
  else if (!built) rows.push(['builder', 'nobody yet']);
  rows.push(['paths', built || plan.state === 'down' ? (PATHS[kind] ?? '') : 'open until built']);
  if (room)
    rows.push(
      ['room', `${room.name}, ${room.tiles} tiles inside`],
      ['role', room.role],
      ['beauty', room.beauty],
      ['impressiveness', room.impressiveness],
    );
  if (house) rows.push(['roof', house.roof]);
  // A home's household and beds, or the hall's role, beds, feasts and mourning (P5.14).
  for (const r of house?.rows ?? []) rows.push([r.name.toLowerCase(), r.text]);
  if (room) {
    rows.push(['beds', room.beds], ['warmth', room.warmth]);
  }
  return rows;
}

/** The lines behind a plan, with their labels: placed, built and waiting. A house's plan was
 * placed by the line that sited it. */
export function planLines(tile: TileView): [LedgerLine, string][] {
  const { plan, house } = tile;
  if (!plan) return [];
  const sited = house?.sited && plan.placed?.id === house.sited.id;
  return [
    ...(plan.waiting ? ([[plan.waiting, 'Waiting · ']] as [LedgerLine, string][]) : []),
    ...(plan.placed
      ? ([
          [
            plan.placed,
            plan.state === 'down' ? 'Ordered down · ' : sited ? 'Sited · ' : 'Planned · ',
          ],
        ] as [LedgerLine, string][])
      : []),
    ...(plan.built ? ([[plan.built, 'Built · ']] as [LedgerLine, string][]) : []),
    ...(house?.lines ?? [])
      .filter((l) => l.id !== plan.built?.id)
      .map((l): [LedgerLine, string] => [l, '']),
  ];
}
