import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { content, contentHash, hashContent, rawContent, validateContent } from './index';

// A deep copy of the fork to break, so each case changes one thing.
const copy = (): Record<string, any> => JSON.parse(JSON.stringify(rawContent));

describe('content', () => {
  it('passes its own validator and fingerprints to 14 hex digits', () => {
    expect(validateContent(rawContent)).toEqual([]);
    expect(contentHash).toMatch(/^[0-9a-f]{14}$/);
    expect(content.races.map((r) => r.id)).toContain('elf');
  });

  it('names every problem in a broken sample', () => {
    const broken = copy();
    broken.cultures[0].raceId = 'elfkin';
    broken.abilities.find((a: any) => a.id === 'kindle').school = 'shadow';
    broken.abilities.push({ ...broken.abilities[0] });
    delete broken.jobs[0].name;
    broken.creatures[0].danger = 'high';
    expect(validateContent(broken).sort()).toEqual(
      [
        'abilities[farming]: duplicate id',
        'abilities[kindle].school: "shadow" is not in schools (known: fire, water, earth, air, …)',
        'creatures[wolf-pack].danger: expected a number, got "high"',
        'cultures[gwerin].raceId: "elfkin" is not in races (known: human, elf, dwarf, orc, …)',
        'jobs[farm].name: missing required field',
      ].sort(),
    );
  });

  it('keeps every spell inside its power tier caps', () => {
    const broken = copy();
    broken.abilities.find((a: any) => a.id === 'kindle').effect.usesPerDay = 9;
    expect(validateContent(broken)).toEqual([
      'abilities[kindle].effect.usesPerDay: 9 is over the faint cap of 3',
    ]);
  });

  it('refuses a calendar the clock cannot count with', () => {
    const broken = copy();
    broken.calendar.monthsPerYear = 14;
    broken.calendar.daysPerMonth = 0;
    expect(validateContent(broken)).toEqual([
      'seasons.months: 12 entries, one per month needed',
      'calendar.daysPerMonth: 0 is not a whole number above 0',
      'calendar.monthNames: 12 names for 14 months',
      "calendar.seasons: 4 seasons don't split 14 months evenly",
    ]);
  });

  it('refuses a vein whose yield is not a haul kind', () => {
    const broken = copy();
    broken.work.haul.kinds = broken.work.haul.kinds.filter((k: string) => k !== 'iron-ore');
    expect(validateContent(broken)).toEqual([
      'features[iron].yields: "iron-ore" is not in work.haul.kinds, so nobody would carry it',
    ]);
  });

  it('changes its fingerprint when any entry changes', () => {
    const changed = copy();
    changed.items[0].per += 0.001;
    expect(hashContent(changed)).not.toBe(contentHash);
    expect(hashContent(copy())).toBe(contentHash);
  });

  it('has a frame in sprites-nature for every vein the map draws underground', () => {
    // A missing frame stops the page with an error screen (the salt seam, 5B Bundle 3).
    const frames = Object.keys(
      JSON.parse(readFileSync('public/art/sprites-nature.json', 'utf8')).frames as object,
    );
    for (const f of content.features.filter((x) => x.kind === 'vein'))
      expect(frames, f.id).toContain(`${f.art}.1`);
  });
});
