// Hotheads at the lord's table (6C Slice 7 part 2, V-236, V-240): one grown-up at his supper who
// resents him (a stash hidden from the barn, a will set against the Lord law, the lean year's tithe
// remembered, bitter at a lord not of their people) may speak out. The odds rise with the grievance;
// at most one speaks a visit. Favour falls, everyone at the table remembers it, and a lord whose
// temper is in `beat` has his men beat the speaker: a light wound, never a death, never a child.
import type { EntityRow } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import { grown } from '../family/index.ts';
import { hiddenOf } from '../goods/index.ts';
import { isDown, wound, woundsOf } from '../health/index.ts';
import { settingOf, weigh } from '../law/index.ts';
import { addMemories, memoriesOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addFavour } from './favour.ts';
import { lordName, lordRow, pronounsOf } from './tables.ts';

/** The words for each grievance, strongest first. */
const WHY: readonly [string, string][] = [
  ['stash', 'who hid goods from the tithe barn'],
  ['will', 'who would defy the Lord law'],
  ['lean', "who remembers the lean year's tithe"],
  ['bitter', 'who will not have a lord not of their people'],
];

/** A person's grievances against the lord, as `WHY` keys. */
function grievances(ctx: SystemContext, p: EntityRow): string[] {
  const { world, content } = ctx;
  const held = new Set(memoriesOf(world, p.id).map((m) => m['memory'] as string));
  const law = settingOf(world, content, content.lord.tithe.law);
  const has: Readonly<Record<string, boolean>> = {
    stash: hiddenOf(world).some((h) => h['person'] === p.id),
    will: weigh(world, content, p.id, law).will < content.laws.answer.grumble,
    lean: held.has(content.lord.tithe.lean.memory),
    bitter: held.has(content.lord.memories.bitter),
  };
  return WHY.map(([k]) => k).filter((k) => has[k]);
}

/** The one most aggrieved among `there` (grown, up and about), drawn on a tie; their points. */
function mostAggrieved(
  ctx: SystemContext,
  there: readonly number[],
): { p: EntityRow; why: string[]; points: number } | undefined {
  const { world, content } = ctx;
  const points = content.lord.visit.hothead.reasons;
  const rows = alive(world)
    .filter((p) => there.includes(p.id) && grown(world, content, p) && !isDown(world, p.id))
    .map((p) => {
      const why = grievances(ctx, p);
      return { p, why, points: why.reduce((n, k) => n + (points[k] ?? 0), 0) };
    })
    .filter((x) => x.points > 0);
  const top = Math.max(0, ...rows.map((x) => x.points));
  const best = rows.filter((x) => x.points === top);
  return best.length ? best[ctx.rng().int(best.length)] : undefined;
}

/** A cruel lord's men beat the speaker: a light wound with its line, unless already hurt. */
function beat(ctx: SystemContext, p: EntityRow, cause: number): void {
  const { world, content } = ctx;
  if (woundsOf(world).some((w) => w['person'] === p.id && w['state'] === 'open')) return;
  const line = ctx.emit('lord.beaten', {
    causes: [cause],
    actors: [p.id],
    data: {
      ...{ lord: lordName(lordRow(world)!), name: p['name'] as string },
      his: pronounsOf(lordRow(world)!).his,
    },
  });
  const m = content.lord.favour.men;
  const kind = m.kinds[ctx.rng().int(m.kinds.length)]!;
  const part = m.parts[ctx.rng().int(m.parts.length)]!;
  wound(
    ctx,
    p,
    { part, kind, severity: m.severity, what: m.what, where: '', place: '' },
    [line],
    false,
  );
}

/** At the lord's supper (line `cause`): the most aggrieved at the table may speak out. */
export function hothead(ctx: SystemContext, there: readonly number[], cause: number): void {
  const { world, content } = ctx;
  const h = content.lord.visit.hothead;
  const who = mostAggrieved(ctx, there);
  if (!who || ctx.rng().int(100) >= Math.min(h.most, who.points * h.odds)) return;
  const lord = lordRow(world)!;
  const says = h.says[ctx.rng().int(h.says.length)]!;
  const why = WHY.find(([k]) => k === who.why[0])![1];
  const line = ctx.emit('lord.hothead', {
    causes: [cause],
    actors: [who.p.id],
    data: { name: who.p['name'] as string, why, says, lord: lordName(lord) },
  });
  addFavour(ctx, 'hothead', [line], { name: who.p['name'] as string });
  addMemories(ctx, [...there], h.memory, line, who.p.id);
  if (h.beat.includes(lord['temper'] as string)) beat(ctx, who.p, line);
}
