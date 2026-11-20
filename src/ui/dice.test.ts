import { describe, expect, it } from 'vitest';
import { content, rawContent, validateContent } from '../content/index.ts';
import { rollSeed } from './dice.ts';

describe('the seed die (6W Slice 1)', () => {
  it('rolls two content words joined by a hyphen, from the ends of both lists too', () => {
    const { first, second } = content.region.seedWords;
    expect(rollSeed(() => 0)).toBe(`${first[0]}-${second[0]}`);
    expect(rollSeed(() => 0.999999)).toBe(`${first.at(-1)}-${second.at(-1)}`);
    expect(rollSeed()).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it('refuses a word list with a repeat or a word that is not lower-case letters', () => {
    const broken = JSON.parse(JSON.stringify(rawContent)) as Record<string, any>;
    broken.region.seedWords.first.push('Ember-Two', broken.region.seedWords.first[0]);
    broken.region.seedWords.second = [];
    expect(validateContent(broken)).toEqual([
      'region.seedWords.first: "Ember-Two" is not one lower-case word',
      `region.seedWords.first: "${content.region.seedWords.first[0]}" appears twice`,
      'region.seedWords.second: no words',
    ]);
  });
});
