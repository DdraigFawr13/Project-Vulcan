// A person's family rows (P6.1): whom they wed and since when, whom they were born to, who took
// them in and what work a child helps with, each with the line that says why. A pure read.
import { content } from '../content/index.ts';
import {
  bondOf,
  childJobs,
  clockAt,
  personOf,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';
import type { WalkerView } from './protocol.ts';

type KinRow = NonNullable<WalkerView['kin']>[number];
const nameOf = (world: WorldState, id: unknown): string =>
  (personOf(world, id)?.['name'] as string | undefined) ?? 'someone';
const jobName = (id: string) => content.jobs.find((j) => j.id === id)?.name.toLowerCase() ?? id;

/** "Thawmonth, year 2". */
function monthOf(tick: number): string {
  const c = clockAt(tick, content.calendar);
  return `${content.calendar.monthNames[c.month]!}, year ${c.year}`;
}

function wedRow(world: WorldState, p: EntityRow): KinRow[] {
  const q = p['partner'] as number;
  const r = q ? bondOf(world, p.id, q) : undefined;
  if (!r || r['state'] !== 'wed') return [];
  const text = `to ${nameOf(world, q)}, since ${monthOf(r['since'] as number)}`;
  return [{ band: 'Wed', text, why: r['line'] as number }];
}

function bornRows(world: WorldState, p: EntityRow): KinRow[] {
  const rows: KinRow[] = [];
  if (p['bornLine'])
    rows.push({
      band: 'Born',
      text: `to ${nameOf(world, p['mother'])} and ${nameOf(world, p['father'])}, year ${p['born'] as number}`,
      why: p['bornLine'] as number,
    });
  const head = p['household'] as number;
  if (p['fostered'] && head) {
    const partner = personOf(world, head)?.['partner'] as number;
    const by = partner
      ? `${nameOf(world, head)} and ${nameOf(world, partner)}`
      : nameOf(world, head);
    rows.push({ band: 'Taken in', text: `by ${by}`, why: p['fostered'] as number });
  }
  const jobs = childJobs(world, content, p);
  if (jobs)
    rows.push({
      band: 'Child',
      text: jobs.length ? `helps with ${jobs.map(jobName).join(', ')}` : 'too young to work',
    });
  return rows;
}

/** The family rows, or none. */
export function kinView(world: WorldState, p: EntityRow): { kin?: KinRow[] } {
  const kin = [...wedRow(world, p), ...bornRows(world, p)];
  return kin.length ? { kin } : {};
}
