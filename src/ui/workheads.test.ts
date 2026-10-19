import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { commonLevel, grouped, visibleJobs } from './workheads.ts';

const job = (id: string, level = 3) => ({ job: id, name: id, level, word: '' });
const all = content.work.priority.jobs.map((id) => job(id));

describe('Work sheet headings', () => {
  it('keep every heading job once, under one heading', () => {
    const ids = content.work.priority.headings.flatMap((h) => h.jobs);
    expect(new Set(ids).size).toBe(ids.length);
    expect(content.work.priority.headings.map((h) => h.name)).toEqual([
      'Stone',
      'Wood',
      'Land',
      'Food',
      'Metal',
    ]);
  });

  it('leave haul, build and tend as plain rows and fold the trades', () => {
    const { plain, groups } = grouped(all);
    expect(plain.map((j) => j.job).sort()).toEqual(['build', 'haul', 'tend']);
    expect(groups.map((g) => [g.name, g.jobs.map((j) => j.job)])).toEqual([
      ['Stone', ['mine', 'quarry']],
      ['Wood', ['fell', 'carpentry']],
      ['Land', ['farm', 'forage']],
      ['Food', ['cook']],
      ['Metal', ['charcoal', 'smelt', 'smith']],
    ]);
  });

  it('hold the mine row back until a shaft exists', () => {
    const rows = all;
    expect(visibleJobs(rows, false).map((j) => j.job)).not.toContain('mine');
    expect(grouped(visibleJobs(rows, false)).groups[0]!.jobs.map((j) => j.job)).toEqual(['quarry']);
    expect(grouped(visibleJobs(rows, true)).groups[0]!.jobs.map((j) => j.job)).toEqual([
      'mine',
      'quarry',
    ]);
  });

  it('show the rows’ common level, or the lowest when they differ', () => {
    expect(commonLevel([3, 3])).toBe(3);
    expect(commonLevel([3, 1, 4])).toBe(1);
  });
});
