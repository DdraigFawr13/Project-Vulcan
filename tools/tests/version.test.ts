import { describe, expect, it } from 'vitest';
import { versionLabel } from '../version.ts';

describe('versionLabel', () => {
  it('takes the newest PR number from merge and squash subjects', () => {
    expect(versionLabel(4, ['Merge pull request #63 from x/y', 'Fix (#61)'])).toBe('v4.63');
    expect(versionLabel(4, ['Smoke tweak', 'Phase 4 Bundle 4 (#62)'])).toBe('v4.62');
  });

  it('says dev when no subject names a PR', () => {
    expect(versionLabel(5, ['Local change', ''])).toBe('v5.dev');
  });
});
