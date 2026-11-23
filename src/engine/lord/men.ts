// The lord's men (6C Slice 2, V-211, V-222): at the bottom of the favour ladder they come with the
// reeve and take `by` in 100 more of what was owed, from the tithe barn first and then the store,
// and may beat one grown-up who refuses the Lord law (who would stand in their way): a light wound
// with a line, and never on someone already hurt. Nobody is killed, nobody is held, and no child is touched.
import { list, type EntityRow } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import { grown } from '../family/index.ts';
import { fromBarn, inStore, itemsOf, takeFrom } from '../goods/index.ts';
import { wound, woundsOf } from '../health/index.ts';
import { settingOf, weigh } from '../law/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lordName, lordRow } from './tables.ts';

/** Takes up to `n` of `kind` from the store's free stacks; how many were taken. */
function fromStore(ctx: SystemContext, kind: string, n: number): number {
  let got = 0;
  for (const i of itemsOf(ctx.world)) {
    if (got >= n) break;
    const at = [i['x'], i['y'], i['z']] as [number, number, number];
    if (i['kind'] !== kind || i['holder'] || i['state'] || !inStore(ctx.world, ...at)) continue;
    got += takeFrom(ctx.world, i, n - got);
  }
  return got;
}

/** A grown-up who refuses the Lord law, drawn from the lord's stream; none when nobody does. */
function inTheWay(ctx: SystemContext): EntityRow | undefined {
  const { world, content } = ctx;
  const s = settingOf(world, content, content.lord.tithe.law);
  const set = alive(world).filter(
    (p) =>
      grown(world, content, p) &&
      p['status'] === 'alive' &&
      !woundsOf(world).some((w) => w['person'] === p.id && w['state'] === 'open') &&
      weigh(world, content, p.id, s).will < content.laws.answer.grumble,
  );
  return set.length ? set[ctx.rng().int(set.length)] : undefined;
}

export function lordMen(
  ctx: SystemContext,
  cause: number,
  owed: [string, number][],
  by: number,
): void {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const took: string[] = [];
  for (const [kind, n] of owed) {
    const want = Math.floor((n * by) / 100);
    const got = fromBarn(world, kind, want);
    const all = got + fromStore(ctx, kind, want - got);
    const name = (content.items.find((d) => d.id === kind)?.name ?? kind).toLowerCase();
    if (all > 0) took.push(`${all} ${name}`);
  }
  const line = ctx.emit('lord.men', {
    causes: [cause],
    data: {
      lord: lordName(lord),
      reeve: lord['reeve'] as string,
      took: took.length ? list(took) : 'nothing, for there was nothing to take',
    },
  });
  const p = inTheWay(ctx);
  if (!p) return;
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
