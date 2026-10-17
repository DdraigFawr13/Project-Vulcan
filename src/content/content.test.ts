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

  it('changes its fingerprint when any entry changes', () => {
    const changed = copy();
    changed.items[0].per += 0.001;
    expect(hashContent(changed)).not.toBe(contentHash);
    expect(hashContent(copy())).toBe(contentHash);
  });
});
