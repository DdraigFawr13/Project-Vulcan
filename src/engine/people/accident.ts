// Accidents (P5.6, V-115): each minute of risky work (content `health.accidents`: a job, or
// `mine:<task>` for mining) carries a small chance of a wound, `perHour` in `chance.per` an
// hour, times skilled ÷ (skilled + the job's skill level), times `chance.worn` per cent with a
// worn tool. Severity is drawn by share, the part from the accident's list; a grave wound may be
// mortal. Rolls draw from the `health` stream. The hurt line cites taking up the work.
import { streamFor, type EntityRow } from '../core/index.ts';
import { wound } from '../health/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { skillOf } from './spots.ts';
import { wornHeld } from './tools.ts';

/** One minute's risk for someone at work, after their choice. */
export function risk(ctx: SystemContext, p: EntityRow): void {
  if (p['doing'] !== 'work' || (p['path'] as number[]).length) return;
  const { world, content } = ctx;
  const job = p['job'] as string;
  const key = job === 'mine' ? `mine:${p['task'] as string}` : job;
  const acc = content.health.accidents.find((a) => a.work.includes(key));
  if (!acc) return;
  const c = content.health.chance;
  const level = skillOf(world, p, content.jobs.find((j) => j.id === job)?.skill ?? '');
  const worn = wornHeld(ctx, p.id, job) ? c.worn : 100;
  const rng = streamFor(world, 'health');
  if (rng.int(c.per * 60 * (c.skilled + level) * 100) >= acc.perHour * c.skilled * worn) return;
  const sevs = content.health.severities;
  const severity = rng.weighted(sevs.map((s) => [s.id, s.share] as const));
  const sev = sevs.find((s) => s.id === severity)!;
  const mortal = !!sev.mortal && rng.int(100) < sev.mortal;
  wound(
    ctx,
    p,
    {
      part: rng.pick(acc.parts),
      kind: acc.wound,
      severity,
      what: acc.what,
      where: acc.where,
      place: acc.at,
    },
    [p['took'] as number],
    mortal,
  );
}
