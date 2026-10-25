// P5.9, P5.14 on the page's side: the words the screens show for homes, the hall and a stranger,
// worked from a real run of anvil's first valley. The band wants homes after a season (1
// Highsun); the first stranger comes on 9 Leaffall and the band speaks within the hour.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, hallOf, step } from '../engine/index.ts';
import { buildView } from './build.ts';
import { peopleOf, walkersOf } from './people.ts';
import { homeOf, homeRows, homesRow, strangerOf, strangersLawView } from './strangers.ts';

const sim = createSim(content);
const DAY = 1440;
const line = (e: { id: number }) => ({ id: e.id }) as never;

describe('strangers and homes in words', () => {
  it('words the homes going up, the hall, a stranger at the green and the law on a split', () => {
    const w = createWorld(sim, 'anvil/1');
    const people = () => w.entities['person'] ?? [];
    step(w, sim, 95 * DAY);
    // Homes: who still wants one, who is next, and whose home each plan is.
    const homes = homesRow(w)!;
    expect(homes.need).toMatch(/^homes of their own for \d: /);
    expect(homes.next).toMatch(/^Next: \w+'s home/);
    expect(buildView(w).houses.some((h) => /'s home$/.test(h.name))).toBe(true);
    const waiting = people().find((p) => homeOf(w, p)?.why);
    expect(homeOf(w, waiting!)!.text).toMatch(/wanted a home of (his|her) own since 1 Highsun/);
    step(w, sim, 81 * DAY);
    // Everyone has moved out of the first cottage, which is the hall.
    expect(homesRow(w)!.need).toBe('everyone has a home of their own.');
    const hall = hallOf(w)!;
    const rows = homeRows(w, hall, line).rows!.map((r) => r.name);
    expect(rows).toEqual(['Role', 'Beds', 'Feasts', 'Mourning']);
    expect(buildView(w).houses.find((h) => h.id === hall.id)?.name).toBe('hall');
    // A stranger at the green: a page of their own and no face in the strip's list.
    let s;
    for (let h = 0; h < 72 && !s; h += 1) {
      step(w, sim, 60);
      s = people().find((p) => p['status'] === 'stranger' && p['stranger']);
    }
    const page = strangerOf(w, s!)!;
    expect(page.who).toMatch(/^A stranger at the green · /);
    expect(page.rows.map((r) => r.name)).toContain('From');
    expect(page.rows.find((r) => r.name === 'Now')!.text).toMatch(/waiting at the green/);
    expect(peopleOf(w).find((p) => p.id === s!.id)?.status).toBe('stranger');
    // The band's word, the law's on a split, and each answer.
    for (let h = 0; h < 4 && !w.systems['strangers']?.['last']; h += 1) step(w, sim, 60);
    const law = strangersLawView(w);
    expect(law.verdict!.text).toMatch(/: \d for, \d against\. /);
    if (law.verdict!.text.includes('Split'))
      expect(law.answers).toHaveLength(people().filter((p) => p['status'] === 'alive').length);
    expect(law.about).toContain('Those in need lets in someone fleeing hunger');
    // Once turned away and off the map, they leave the page's people.
    if (s!['status'] !== 'alive') {
      step(w, sim, 2 * DAY);
      expect(walkersOf(w).some((x) => x.id === s!.id)).toBe(false);
    }
  }, 60000);
});
