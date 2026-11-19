// A Rations setting's day of food (P6.5): its `share` per cent of what the food need falls in a
// day, in food worth; 0 for a setting with no share.
import type { LawSettingDef } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';

export function shareOf(ctx: SystemContext, s: LawSettingDef): number {
  const fall = ctx.content.life.needs.find((n) => n.id === 'food')?.fall ?? 0;
  return s.share ? Math.round((fall * 24 * s.share) / 100) : 0;
}
