// P6.6 done-when (V-158, V-159): a faction forms from a shared grievance, in a table: under
// Hunger rations, whoever is `strong` points short of keeping the law (weighed alone) stands
// together once there are `least` of them and a fifth of the colony; it is named from content,
// brings a petition, and its members lean against the law together. Also: the petition is heard
// when the law steps back and the faction breaks up; let stand, standing falls; the elder's death
// shakes standing; low standing makes a law easier to refuse.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  elderOf,
  factionsOf,
  settingOf,
  standingOf,
  step,
  submitCommand,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  trustOf,
  weigh,
  type EntityRow,
} from '../index.ts';
import { trustBy } from './vote.ts';

const sim = createSim(content);
type World = ReturnType<typeof createWorld>;
const alive = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const { faction: fd } = content.colony;

function command(w: World, kind: string, data: Record<string, string | number>): void {
  submitCommand(w, { tick: w.tick + 1, kind, data });
  step(w, sim, 2);
}

/** Runs on to just after the colony's daily reckoning. */
function toReckoning(w: World): void {
  const at = content.colony.hour * TICKS_PER_HOUR + 1;
  const wait = (at - (w.tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  step(w, sim, wait || TICKS_PER_DAY);
}

/** Each person's grievance with the law's setting: points short of keeping it, weighed alone. */
function grievances(w: World, law: string): { name: string; short: number }[] {
  const s = settingOf(w, content, law);
  return alive(w).map((p) => ({
    name: p['name'] as string,
    short: content.laws.answer.obey - weigh(w, content, p.id, s, { alone: true }).will,
  }));
}

/** A world under Hunger rations just after the reckoning a faction formed at, and the table of
 * grievances as that reckoning weighed them. */
function hungerWorld(seed: string) {
  const w = createWorld(sim, seed);
  step(w, sim, 60);
  command(w, 'setLaw', { law: 'rations', setting: 'hunger' });
  for (let day = 0; day < 6 && !factionsOf(w).length; day++) toReckoning(w);
  return { w, table: grievances(w, 'rations') };
}

describe('standing, the elder and factions', () => {
  it('forms a faction from a shared grievance, as the table says', () => {
    const { w, table } = hungerWorld('anvil');
    const strong = table.filter((r) => r.short >= fd.strong).map((r) => r.name);
    expect(strong.length).toBeGreaterThanOrEqual(fd.least);
    expect(strong.length * 100).toBeGreaterThanOrEqual(fd.share * table.length);
    const [f] = factionsOf(w) as [EntityRow];
    const names = (f['members'] as number[]).map(
      (m) => alive(w).find((p) => p.id === m)!['name'] as string,
    );
    // The members are exactly the people the table says hold the grievance strongly.
    expect(names.sort()).toEqual(strong.sort());
    expect(content.laws.laws.find((l) => l.id === 'rations')!.settings[2]!.faction).toContain(
      f['name'],
    );
    const formed = lines(w, 'colony.faction').at(-1)!;
    const petition = lines(w, 'colony.petition').at(-1)!;
    expect(petition.causes).toContain(formed.id);
    expect(petition.data).toMatchObject({ asks: 'Short rations', setting: 'Hunger rations' });
    // Each member now weighs the law with the faction, and says so.
    const s = settingOf(w, content, 'rations');
    for (const m of f['members'] as number[])
      expect(weigh(w, content, m, s).against).toContain(`stands with ${f['name'] as string}`);
  });

  it('hears a petition when the law steps back, and the faction breaks up', () => {
    const { w } = hungerWorld('anvil');
    const before = standingOf(w, content);
    command(w, 'setLaw', { law: 'rations', setting: 'short' });
    step(w, sim, TICKS_PER_HOUR);
    expect(factionsOf(w)).toEqual([]);
    expect(lines(w, 'colony.disbanded').at(-1)!.data['why']).toMatch(/Short rations/);
    expect(standingOf(w, content)).toBe(before + content.colony.standing.answered.by);
  });

  it('lets a petition stand at a cost to standing, and an elder dying shakes it', () => {
    const { w } = hungerWorld('anvil');
    const f = factionsOf(w)[0]!;
    const before = standingOf(w, content);
    command(w, 'letStand', { faction: f.id });
    expect(f['state']).toBe('stood');
    expect(standingOf(w, content)).toBe(before + content.colony.standing.stood.by);
    // Run on to a week's end, when the elder is first worked out.
    while (!elderOf(w)) toReckoning(w);
    const elder = alive(w).find((p) => p.id === elderOf(w))!;
    const was = standingOf(w, content);
    elder['status'] = 'dead';
    step(w, sim, TICKS_PER_HOUR);
    expect(elderOf(w)).toBe(0);
    expect(standingOf(w, content)).toBe(was + content.colony.standing.elderDied.by);
    expect(lines(w, 'colony.standing').at(-1)!.data['text']).toMatch(/the elder, died/);
  });

  it('makes every law easier to refuse when standing is low', () => {
    const w = createWorld(sim, 'smoke');
    const s = content.laws.laws.find((l) => l.id === 'work-hours')!.settings[2]!;
    const p = alive(w)[0]!;
    const high = weigh(w, content, p.id, s).will;
    w.entities['standing']![0]!['standing'] = 20;
    const low = weigh(w, content, p.id, s);
    expect(low.will).toBe(high - 6);
    expect(low.against).toContain('distrusts the colony');
  });

  it('picks the elder by vote, each through their own eyes: a fright looks to the guard', () => {
    const w = createWorld(sim, 'smoke');
    while (!elderOf(w)) toReckoning(w);
    expect(lines(w, 'colony.elder').at(-1)!.data['why']).toMatch(/^\d+ of \d+ look to them/);
    const [voter, other] = alive(w) as [EntityRow, EntityRow];
    const c = { p: other, trust: trustOf(w, content, other).trust };
    const near = new Set<number>();
    const before = trustBy(w, content, voter, c, near, 0);
    addEntity(w, 'role', {
      person: other.id,
      role: 'guard',
      points: 10,
      why: '',
      line: 0,
      since: 0,
    });
    expect(trustBy(w, content, voter, c, near, 0)).toBe(before);
    addEntity(w, 'memory', {
      ...{ person: voter.id, memory: 'fear-attack', until: w.tick + TICKS_PER_DAY, line: 0 },
      ...{ about: 0, weight: 1, since: w.tick, first: 0, last: 0, days: 1, mask: 1, fresh: 1 },
    });
    const { vote } = content.colony.elder;
    expect(trustBy(w, content, voter, c, near, 0)).toBe(before + vote.plight);
    expect(trustBy(w, content, voter, c, new Set([other.id]), vote.incumbent)).toBe(
      before + vote.plight + vote.friend + vote.incumbent,
    );
  });
});
