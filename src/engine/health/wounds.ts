// Wounds (P5.6, V-114, V-115): a wound is a row on one of the six body parts content lists, with
// its kind, severity, bleeding and the care it has had; a person's `body` row holds their blood
// and whether they can stand. A lasting mark left by a healed wound is a `scar` row with the
// content entry's plain effect (a lame leg walks slower, a maimed arm works slower).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const HEALTH_TABLES: Schemas = {
  /** `part`, `kind` (a `wounds` id) and `severity` from content; `bleed` 0 none, 1 slow, 2 fast,
   * now; `mortal` 1 for a wound that bleeds fast whatever is done; `bound` 0 not yet, 1 roughly
   * (by whoever found them), 2 by a healer; `dressed` the tick a healer last dressed it and
   * `healer` who; `progress` hundredths of an hour healed; `fester` 0 never, 1 fevered, 2 the
   * fever broke, and `feverEnd` the tick it breaks; `line` the hurt line and `care` the last
   * line of care (found, carried, bound); `fevered` the festering line; `state` `open`,
   * `healed` or `closed` (at death); `at` the tick it was taken; `where` and `place` ("shaft",
   * "in") from the accident. */
  wound: {
    person: 'entity',
    part: 'text',
    kind: 'text',
    severity: 'text',
    bleed: 'count',
    mortal: 'count',
    bound: 'count',
    dressed: 'int',
    healer: 'entity',
    progress: 'count',
    fester: 'count',
    feverEnd: 'int',
    line: 'event',
    care: 'event',
    fevered: 'event',
    state: 'text',
    at: 'int',
    where: 'text',
    place: 'text',
  },
  /** A lasting mark (content `marks`) on a part, and the line it healed under. */
  scar: { person: 'entity', mark: 'text', part: 'text', line: 'event' },
  /** One a person once hurt: `blood` 0 to content `blood.full`; `down` 1 while they cannot
   * stand; `carrier` who carries them (or their body) now; `healer` who is on the way to bind
   * them; `finder` who is finding or found them and `found` the line they were found by;
   * `bed` the furniture piece or bedroll they were laid on (0 for
   * none) and `roll` 1 when it is a bedroll; `died` the death line (0 while alive) and `diedAt`
   * its tick; `alerted` 1
   * once an unburied body has been said; `missed` 1 once someone went to look for them. */
  body: {
    person: 'entity',
    blood: 'count',
    down: 'count',
    carrier: 'entity',
    healer: 'entity',
    finder: 'entity',
    found: 'event',
    bed: 'entity',
    roll: 'count',
    died: 'event',
    diedAt: 'int',
    alerted: 'count',
    missed: 'count',
  },
};

export const woundsOf = (world: WorldState): EntityRow[] => world.entities['wound'] ?? [];
export const bodiesOf = (world: WorldState): EntityRow[] => world.entities['body'] ?? [];
export const scarsOf = (world: WorldState, person: number): EntityRow[] =>
  (world.entities['scar'] ?? []).filter((m) => m['person'] === person);

export const openWounds = (world: WorldState, person: number): EntityRow[] =>
  woundsOf(world).filter((w) => w['person'] === person && w['state'] === 'open');

export const bodyOf = (world: WorldState, person: number): EntityRow | undefined =>
  bodiesOf(world).find((b) => b['person'] === person);

export const personOf = (world: WorldState, id: number): EntityRow | undefined =>
  (world.entities['person'] ?? []).find((p) => p.id === id);

export const severityOf = (content: EngineContent, w: EntityRow) =>
  content.health.severities.find((s) => s.id === w['severity'])!;

export const partDef = (content: EngineContent, id: string) =>
  content.health.parts.find((p) => p.id === id);

/** Whether `person` lies down and cannot walk (P5.6): their body row says so. */
export const isDown = (world: WorldState, person: number): boolean =>
  !!bodyOf(world, person)?.['down'];

/** He, him, his for `m`; she, her, her otherwise. */
export function pronouns(p: EntityRow): { they: string; them: string; their: string } {
  return p['sex'] === 'm'
    ? { they: 'he', them: 'him', their: 'his' }
    : { they: 'she', them: 'her', their: 'her' };
}

const fill = (text: string, slots: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? '');

/** A wound kind's words: its `minor` ones for a wound that does not bleed. */
function wordsOf(content: EngineContent, w: EntityRow) {
  const def = content.health.wounds.find((d) => d.id === w['kind']);
  return def?.minor && severityOf(content, w).bleed === 0 ? def.minor : def;
}

/** "broken left leg". */
export function woundName(content: EngineContent, w: EntityRow): string {
  const def = wordsOf(content, w);
  const part = partDef(content, w['part'] as string)?.name ?? (w['part'] as string);
  return fill(def?.name ?? '{part}', { part });
}

/** "a deep break to his left leg". */
export function woundWords(content: EngineContent, w: EntityRow, p: EntityRow): string {
  const def = wordsOf(content, w);
  const part = partDef(content, w['part'] as string)?.name ?? (w['part'] as string);
  const severity = severityOf(content, w).name;
  return fill(def?.a ?? 'a {severity} wound to {their} {part}', {
    part,
    severity,
    their: pronouns(p).their,
  });
}

/** The worst of their open wounds: graver first, then the most bleeding. */
export function worstOf(content: EngineContent, wounds: readonly EntityRow[]) {
  const rank = (w: EntityRow) =>
    content.health.severities.findIndex((s) => s.id === w['severity']) * 10 +
    (w['bleed'] as number);
  return [...wounds].sort((a, b) => rank(b) - rank(a) || a.id - b.id)[0];
}

/** The body row of `p`, made with full blood on their first wound. */
export function ensureBody(world: WorldState, content: EngineContent, p: EntityRow): EntityRow {
  const had = bodyOf(world, p.id);
  if (had) return had;
  addEntity(world, 'body', {
    ...{ person: p.id, blood: content.health.blood.full, down: 0, carrier: 0, healer: 0 },
    ...{ finder: 0, found: 0, bed: 0, roll: 0, died: 0, diedAt: 0, alerted: 0, missed: 0 },
  });
  return bodyOf(world, p.id)!;
}

/** Whether a wound keeps them off their feet now: any `down` severity, or one to a
 * `downLimb` that bleeds, until it is `upAt` per cent healed; or a fever. */
export function keepsDown(content: EngineContent, w: EntityRow): boolean {
  const sev = severityOf(content, w);
  const h = content.health;
  if (w['fester'] === 1) return true;
  const healing = (w['progress'] as number) * 100 < h.upAt * sev.days * 24 * 100;
  const leg = partDef(content, w['part'] as string)?.limb === h.downLimb && sev.bleed > 0;
  return (sev.down || leg) && healing;
}

/** Whether they can work with their hands: not with an open deep or grave arm wound. */
export function armOut(world: WorldState, content: EngineContent, person: number): boolean {
  return openWounds(world, person).some(
    (w) =>
      partDef(content, w['part'] as string)?.limb === 'arm' && severityOf(content, w).bleed > 0,
  );
}

/** Their lasting marks' effect on `effect` (`walk`, `work`), as a per cent: 100 with none. */
export function markPercent(
  world: WorldState,
  content: EngineContent,
  person: number,
  effect: string,
): number {
  let pc = 100;
  for (const m of world.entities['scar'] ?? []) {
    if (m['person'] !== person) continue;
    const def = content.health.marks.find((d) => d.id === m['mark']);
    if (def?.effect === effect) pc = Math.floor((pc * def.by) / 100);
  }
  return pc;
}

/** The mark a healed wound to this part leaves, if any content entry fits it. */
export function markFor(content: EngineContent, part: string) {
  const limb = partDef(content, part)?.limb;
  return content.health.marks.find((m) => (m.part ? m.part === part : !!limb && m.limb === limb));
}

/** A hurt person stops: what they carried is put down where they stand, their work is dropped
 * and, when they cannot stand, they lie where they are. */
export function stopFor(ctx: SystemContext, p: EntityRow, down: boolean): void {
  for (const i of ctx.world.entities['item'] ?? [])
    if (i['holder'] === p.id && i['state'] !== 'worn' && i['state'] !== 'held')
      Object.assign(i, { holder: 0, x: p['x'], y: p['y'], z: p['z'] });
  Object.assign(p, { job: '', target: -1, work: 0, task: '', what: '', plan: 0 });
  if (!down) return;
  p['path'] = [];
  p['stride'] = 0;
  p['doing'] = 'hurt';
}

/** Gives `p` a wound and writes the hurt line (citing `causes`); `what` is how it happened
 * ("fell in the shaft"), `where` and `place` where ("shaft", "in"). The line is notable for a
 * deep or grave wound. */
export function wound(
  ctx: SystemContext,
  p: EntityRow,
  w: { part: string; kind: string; severity: string; what: string; where: string; place: string },
  causes: readonly number[],
  mortal: boolean,
): EntityRow {
  const { world, content } = ctx;
  const sev = content.health.severities.find((s) => s.id === w.severity)!;
  const body = ensureBody(world, content, p);
  const id = addEntity(world, 'wound', {
    ...{ person: p.id, part: w.part, kind: w.kind, severity: w.severity, bleed: sev.bleed },
    ...{ mortal: mortal ? 1 : 0, bound: 0, dressed: 0, healer: 0, progress: 0, fester: 0 },
    ...{ feverEnd: 0, line: 0, care: 0, fevered: 0, state: 'open', at: world.tick },
    ...{ where: w.where, place: w.place },
  });
  const row = woundsOf(world).find((r) => r.id === id)!;
  const { their } = pronouns(p);
  row['line'] = ctx.emit('health.hurt', {
    causes: causes.filter((c) => c > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: fill(w.what, { where: w.where, their }),
      wound: woundWords(content, row, p),
      serious: sev.bleed > 0 ? 'yes' : 'no',
    },
  });
  // Someone who can stand binds a slow-bleeding wound roughly themselves (P5.6).
  const down = keepsDown(content, row);
  if (!down && sev.bleed === 1 && !mortal) Object.assign(row, { bound: 1, bleed: 0 });
  stopFor(ctx, p, down);
  if (down) body['down'] = 1;
  return row;
}
