import { describe, expect, it } from 'vitest';
import { checkModule } from '../check-boundaries.mjs';

const at = (file: string) => `${process.cwd()}/src/${file}`;

describe('boundaries check', () => {
  it('rejects nondeterminism and outward imports in the engine', () => {
    for (const code of [
      'export const x = Math.random();',
      'export const x = Math.sin(1);',
      'export const x = Date.now();',
      "import '../ui/main.ts';",
      "import 'phaser';",
    ])
      expect(checkModule(at('engine/a.ts'), code)).not.toEqual([]);
  });

  it('reaches a system only through its index.ts', () => {
    const from = at('engine/jobs/queue.ts');
    expect(checkModule(from, "import { a } from '../rng/index.ts';")).toEqual([]);
    expect(checkModule(from, "import { a } from './plan.ts';")).toEqual([]);
    expect(checkModule(from, "import { a } from '../rng/sfc32.ts';")).not.toEqual([]);
  });

  it('gives the browser layers their APIs and Phaser only to render and ui', () => {
    expect(checkModule(at('ui/main.ts'), 'export const x = Math.random();')).toEqual([]);
    expect(checkModule(at('worker/loop.ts'), 'setInterval(() => {}, 50);')).toEqual([]);
    expect(checkModule(at('render/scene.ts'), "import Phaser from 'phaser';")).toEqual([]);
    expect(checkModule(at('worker/loop.ts'), "import Phaser from 'phaser';")).not.toEqual([]);
  });
});
