// A maker's first fine piece (V-093): the first time anyone makes something of fine quality or
// better, furniture or a tool, one notable line says so. The person row keeps the line (`fine`).
import type { EntityRow } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** Whether a quality score reaches `fine` (the quality words run best first). */
export function isFine(ctx: SystemContext, score: number): boolean {
  const words = ctx.content.buildings.furniture.quality;
  const fine = words.find((q) => q.id === 'fine');
  return !!fine && score >= fine.at;
}

/** Says `p`'s first fine-or-better piece, once; `made` is the line that made it. */
export function firstFine(
  ctx: SystemContext,
  p: EntityRow,
  score: number,
  word: string,
  what: string,
  made: number,
): void {
  if (p['fine'] || !isFine(ctx, score)) return;
  p['fine'] = ctx.emit('craft.firstFine', {
    causes: [made],
    actors: [p.id],
    data: { name: p['name'] as string, word, what },
  });
}
