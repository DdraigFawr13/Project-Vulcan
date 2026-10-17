import { describe, expect, it } from 'vitest';
import { checkModule } from '../../scripts/check-boundaries.mjs';

const at = (layer: string) => `${process.cwd()}/src/${layer}/file.ts`;

describe('boundaries check', () => {
  it('rejects nondeterminism in the engine', () => {
    expect(checkModule(at('engine'), 'export const x = Math.random();')).not.toEqual([]);
    expect(checkModule(at('engine'), 'export const x = Math.sin(1);')).not.toEqual([]);
    expect(checkModule(at('engine'), 'export const x = Date.now();')).not.toEqual([]);
    expect(checkModule(at('engine'), "import '../app/main.ts';")).not.toEqual([]);
  });

  it('allows the UI and platform their browser APIs', () => {
    expect(checkModule(at('app'), 'export const x = Math.random();')).toEqual([]);
    expect(checkModule(at('platform'), 'setInterval(() => {}, 50);')).toEqual([]);
  });
});
