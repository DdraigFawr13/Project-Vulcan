// What a wandering master leaves (6C Slice 7, V-236): at their season's end (`methods.master`
// line) each living puzzler on a way of the master's trade takes one hint from watching them,
// never the whole way; and a master the band lets stay keeps the way they brought, so the valley
// gains a knower (`discover.brought`, a `knows` row come by `master`).
import type { EntityRow, SimEvent } from '../core/index.ts';
import { addEntity, alive, entityOf } from '../entity/index.ts';
import { pronouns } from '../health/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addHint } from './find.ts';
import { knows, methodDef, puzzlesNow } from './tables.ts';

/** A master's season-end line: a hint for each living puzzler on one of its `ways`. */
export function masterHints(ctx: SystemContext, e: SimEvent): void {
  const ways = String(e.data['ways'] ?? '').split('|');
  const living = new Set(alive(ctx.world).map((p) => p.id));
  for (const q of puzzlesNow(ctx.world)) {
    const who = q['person'] as number;
    if (q['ended'] || !living.has(who) || who === e.actors[0]) continue;
    if (ways.includes(q['method'] as string))
      addHint(ctx, q, 'master', [e.id], { names: e.data['name'] });
  }
}

/** The band's word that let them stay: a master among them keeps the way they brought. */
export function broughtWays(ctx: SystemContext, e: SimEvent): void {
  const { world, content } = ctx;
  for (const id of e.actors) {
    const p: EntityRow | undefined = entityOf(world, 'person', id);
    const m = p?.['way'] ? methodDef(content, p['way'] as string) : undefined;
    if (!p || !m || p['status'] !== 'alive' || knows(world, p.id, m.id)) continue;
    const line = ctx.emit('discover.brought', {
      causes: [e.id],
      actors: [p.id],
      data: {
        ...{ name: p['name'] as string, method: m.name, noun: p['master'] as string },
        they: pronouns(p).they,
      },
    });
    addEntity(world, 'knows', { person: p.id, method: m.id, how: 'master', line, from: 0 });
  }
}
