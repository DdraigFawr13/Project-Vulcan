// What the hurt and the sick, and those caring for them, are doing, in content `work.doing` words (P5.6, P5.8).
import { content } from '../content/index.ts';
import { bodyOf, openWounds, woundName, type EntityRow, type WorldState } from '../engine/index.ts';
import { boutOf, illDef } from './illview.ts';

type Say = (key: string, vars?: Record<string, string>) => string;

const nameOf = (world: WorldState, id: unknown): string =>
  ((world.entities['person'] ?? []).find((q) => q.id === id)?.['name'] as string) ?? '';

/** The worst open wound's name, or ''. */
function woundOf(world: WorldState, person: number): string {
  const w = openWounds(world, person).sort(
    (a, b) =>
      content.health.severities.findIndex((s) => s.id === b['severity']) -
        content.health.severities.findIndex((s) => s.id === a['severity']) || a.id - b.id,
  )[0];
  return w ? woundName(content, w) : '';
}

/** The sentence for someone lying hurt or on care work, or undefined for anyone else. */
export function careNow(world: WorldState, p: EntityRow, say: Say): string | undefined {
  if (p['doing'] === 'hurt') {
    const wound = woundOf(world, p.id);
    const bout = boutOf(world, p.id);
    const ill = bout?.['state'] === 'sick' ? illDef(bout['ill']) : undefined;
    if (!wound && ill?.abed) return say('sick', { ill: ill.name });
    return say(wound ? 'hurt' : 'hurtWeak', { wound });
  }
  const job = p['job'] as string;
  const who = (id: unknown) => (world.entities['person'] ?? []).find((q) => q.id === id);
  if (job === 'carry') {
    const q = who(p['target']);
    const carrying = q && bodyOf(world, q.id)?.['carrier'] === p.id;
    return say(carrying ? 'carry' : 'find', { name: nameOf(world, p['target']) });
  }
  if (job === 'bind' || job === 'dress')
    return say(job, {
      name: nameOf(world, p['target']),
      wound: woundOf(world, p['target'] as number),
    });
  if (job === 'draught') return say('draught', { name: nameOf(world, p['target']) });
  if (job === 'feed') return say('feed', { name: nameOf(world, p['plan']) });
  if (job === 'bury')
    return say(p['task'] === 'dig' ? 'dig' : 'bury', { name: nameOf(world, p['target']) });
  return undefined;
}
