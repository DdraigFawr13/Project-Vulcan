import { describe, expect, it } from 'vitest';
import { compare, measureFunctions } from '../check-shape.mjs';

describe('measureFunctions', () => {
  it('counts each decision point once and nested functions on their own', () => {
    const text = [
      'export function pick(a: number, b?: number) {',
      '  if (a > 1 && b) return 1;',
      '  for (const x of [a]) if (x) return x ?? 2;',
      '  const inner = (y: number) => (y ? 1 : 0);',
      '  switch (a) { case 1: return 3; default: return inner(a); }',
      '}',
    ].join('\n');
    const found = measureFunctions(text);
    const pick = found.find((f) => f.name === 'pick');
    const inner = found.find((f) => f.name === 'inner');
    // pick: 1 + if + && + for + if + ?? + case 1 = 7; the arrow's ?: counts only for inner.
    expect(pick).toMatchObject({ lines: 6, complexity: 7 });
    expect(inner).toMatchObject({ lines: 1, complexity: 2 });
  });
});

describe('compare', () => {
  const base = { counts: { longFunctions: 3 }, modules: { 'src/a/MODULE.md': 9000 } };

  it('fails a count or a contract that grew, and a new contract over the cap', () => {
    const now = {
      counts: { longFunctions: 4 },
      modules: { 'src/a/MODULE.md': 9001, 'src/b/MODULE.md': 6200 },
    };
    expect(compare(now, base).rose).toEqual([
      'longFunctions: 4, was 3',
      'src/a/MODULE.md: 9001 bytes, cap 9000',
      'src/b/MODULE.md: 6200 bytes, cap 6144',
    ]);
  });

  it('passes and reports what fell', () => {
    const { rose, fell } = compare({ counts: { longFunctions: 2 }, modules: {} }, base);
    expect(rose).toEqual([]);
    expect(fell).toEqual(['longFunctions: 2, was 3', 'src/a/MODULE.md: now under 6144 bytes']);
  });
});
