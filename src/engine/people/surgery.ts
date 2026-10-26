// Stitching and setting (P5.7, V-136): when a healer binds or dresses a deep or grave wound of a
// kind the healer's kit serves (health.json `kit`), they stitch a cut or bite, or set a break or
// crush, once. With a kit held it takes `perSkill` per herbalism point plus the kit's speed over
// plain stone and its quality off the chance of festering (a stitch) or healing crooked (a
// setting), at most `most`; without a kit a bone is set by hand at `hand` per cent of the skill,
// and nothing is stitched. One line each, naming the kit.
import type { EntityRow } from '../core/index.ts';
import { severityOf, woundName } from '../health/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { bestHeld, equip, materialSpeed } from './tools.ts';
import { skillOf } from './spots.ts';

/** The healer `h` stitches or sets what of `wounds` they can and has not been. */
export function sew(ctx: SystemContext, h: EntityRow, p: EntityRow, wounds: readonly EntityRow[]) {
  const { world, content } = ctx;
  const kit = content.health.kit;
  const skill = skillOf(
    world,
    h,
    content.jobs.find((j) => j.id === content.health.care.job)?.skill ?? '',
  );
  equip(ctx, h, content.health.care.job);
  const tool = bestHeld(ctx, h.id, kit.tool);
  for (const w of wounds) {
    if (w['sewnBy'] || severityOf(content, w).bleed === 0) continue;
    const stitch = kit.stitch.includes(w['kind'] as string);
    if (!stitch && !kit.set.includes(w['kind'] as string)) continue;
    if (stitch && !tool) continue;
    const cut = tool
      ? kit.perSkill * skill +
        Math.floor((materialSpeed(content, tool) - 100) / 10) +
        (content.tools.quality[tool['quality'] as string] ?? 0)
      : Math.floor((kit.perSkill * skill * kit.hand) / 100);
    Object.assign(w, { sewn: Math.max(0, Math.min(kit.most, cut)), sewnBy: h.id });
    const name = tool ? (content.items.find((i) => i.id === tool['kind'])?.name ?? '') : '';
    const quality = tool && tool['quality'] !== 'plain' ? `${tool['quality']} ` : '';
    w['care'] = ctx.emit('health.stitched', {
      causes: [w['care'] as number, w['line'] as number].filter((c) => c > 0),
      actors: [h.id, p.id],
      data: {
        healer: h['name'] as string,
        name: p['name'] as string,
        did: stitch ? 'stitched' : 'set',
        wound: woundName(content, w),
        with: tool ? `with a ${quality}${name}` : 'by hand',
      },
    });
  }
}
