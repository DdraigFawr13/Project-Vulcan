// A tile's plan or built part on the tile page (P3.1, P3.2): what it is, how much material has
// been brought, who is on it and what it does to the way, then the lines behind it.
import type { LedgerLine, TileView } from '../worker/index.ts';

type PlanView = NonNullable<TileView['plan']>;

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

/** The tile page's rows for a plan or built part: key and value. */
export function planFacts(plan: PlanView): [string, string][] {
  const kind = plan.part.split('-')[0]!;
  const built = plan.state === 'built';
  const rows: [string, string][] = [
    [built ? 'built' : 'plan', `${plan.name}, ${STATES[plan.state] ?? plan.state}`],
  ];
  if (!built) rows.push([plan.good, `${plan.have} of ${plan.cost} here`]);
  if (plan.builder) rows.push(['builder', `${plan.builder}, ${plan.doing ?? 'on it'}`]);
  else if (!built) rows.push(['builder', 'nobody yet']);
  rows.push(['paths', built || plan.state === 'down' ? (PATHS[kind] ?? '') : 'open until built']);
  return rows;
}

/** The lines behind a plan, with their labels: placed, built and waiting. */
export function planLines(plan: PlanView): [LedgerLine, string][] {
  return [
    ...(plan.waiting ? ([[plan.waiting, 'Waiting · ']] as [LedgerLine, string][]) : []),
    ...(plan.placed
      ? ([[plan.placed, plan.state === 'down' ? 'Ordered down · ' : 'Planned · ']] as [
          LedgerLine,
          string,
        ][])
      : []),
    ...(plan.built ? ([[plan.built, 'Built · ']] as [LedgerLine, string][]) : []),
  ];
}
