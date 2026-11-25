// A thing made for an ask (6C Slice 3, V-225): who may work an ask and how fast, and the smith's
// piece for one. Under the Lord law, those who would refuse it (their will to keep Loyal under the
// law's `grumble`) never touch the lord's asks, and grumblers take `asks.grumble` minutes in 100.
// The piece lies with the cart for a carrier to set apart in the tithe barn (band askhaul.ts),
// if it is as good as the ask wants.
import { streamFor, type EntityRow } from '../core/index.ts';
import { qualityOf } from '../build/index.ts';
import { fitsAsk, layTool, restOf } from '../goods/index.ts';
import { weigh } from '../law/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { firstFine } from './fine.ts';

/** The taken-up ask `p` is working, if it is still taken up. */
export const askFor = (ctx: SystemContext, p: EntityRow): EntityRow | undefined =>
  p['ask']
    ? (ctx.world.entities['ask'] ?? []).find((a) => a.id === p['ask'] && a['state'] === 'taken')
    : undefined;

/** `p`'s will to keep the Lord law at Loyal (the law's start when there is no such law). */
function lordWill(ctx: SystemContext, p: EntityRow): number {
  const { world, content } = ctx;
  const def = content.laws.laws.find((l) => l.id === content.lord.tithe.law);
  const loyal = def?.settings.find((s) => s.id === 'loyal');
  return loyal ? weigh(world, content, p.id, loyal).will : content.laws.answer.start;
}

/** Whether `p` will work ask `a`: anyone, but a lord's ask not by one who would refuse him. */
export const willWork = (ctx: SystemContext, p: EntityRow, a: EntityRow): boolean =>
  a['source'] !== 'lord' || lordWill(ctx, p) >= ctx.content.laws.answer.grumble;

/** Minutes in 100 `p` takes over ask `a`: a grumbler at the Lord law is slower on his asks. */
export const askPace = (ctx: SystemContext, p: EntityRow, a: EntityRow): number =>
  a['source'] === 'lord' && lordWill(ctx, p) < ctx.content.laws.answer.obey
    ? ctx.content.asks.grumble
    : 100;

/** The piece is made: its quality rolled as any tool's, it lies with the cart, and a line says
 * whom it is for and whether it is as good as they asked. */
export function madeForAsk(
  ctx: SystemContext,
  p: EntityRow,
  a: EntityRow,
  tool: { kind: string; material: string; level: number; trail: string },
): void {
  const { world, content } = ctx;
  const t = content.tools;
  const score = tool.level + streamFor(world, t.stream).between(-t.roll, t.roll);
  const word = qualityOf(content, score);
  const k = t.kinds.find((x) => x.id === tool.kind)!;
  const m = t.materials.find((x) => x.id === tool.material)!;
  const plain = word.id === 'plain' ? '' : `${word.word} `;
  const what = `${/^[aeiou]/.test(plain || m.name) ? 'an' : 'a'} ${plain}${m.name} ${k.name}`;
  const item = layTool(world, content, restOf(world, content), {
    ...{ kind: tool.kind, material: tool.material, quality: word.id, made: 0 },
    trail: tool.trail,
    maker: p.id,
  });
  a['made'] = ((a['made'] as number) || 0) + 1;
  const fits = fitsAsk(content, a, item);
  const line = ctx.emit('ask.made', {
    causes: [p['took'] as number, a['line'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: {
      ...{ name: p['name'] as string, what, asker: a['asker'] as string },
      fit: fits ? '' : `, not as good as was asked`,
    },
  });
  item['made'] = line;
  firstFine(ctx, p, score, word.word, what, line);
}
