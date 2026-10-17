// Size limits that keep every thread's reading small (PLAN.md §6, RULES.md VR-44 and VR-50).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { dirs, isMain, rel, root, walk } from './lib.mjs';

export const limits = {
  codeLines: 400, // per source file; content data under src/content/data is exempt
  moduleLines: 40, // per MODULE.md
  briefBytes: 6144, // docs/AGENT_BRIEF.md
  specBytes: 9000, // docs/phases/PHASE_N.md, about two pages
};

export function checkLimits() {
  const errors = [];
  const lines = (file) => readFileSync(file, 'utf8').trimEnd().split('\n').length;
  const code = walk(path.join(root, 'src'), (f) => /\.(ts|tsx|mjs)$/.test(f))
    .concat(walk(path.join(root, 'tools'), (f) => /\.(ts|mjs)$/.test(f)))
    .filter((f) => !rel(f).startsWith('src/content/data/'));
  for (const file of code)
    if (lines(file) > limits.codeLines)
      errors.push(`${rel(file)}: ${lines(file)} lines, over ${limits.codeLines}; split it.`);

  // Every layer and every system folder has a MODULE.md contract; system folders also an index.ts.
  for (const layer of dirs(path.join(root, 'src'))) {
    for (const folder of [layer, ...dirs(layer).filter((d) => !d.endsWith(`${path.sep}data`))]) {
      const contract = path.join(folder, 'MODULE.md');
      if (!existsSync(contract)) errors.push(`${rel(folder)}: missing MODULE.md.`);
      else if (lines(contract) > limits.moduleLines)
        errors.push(`${rel(contract)}: over ${limits.moduleLines} lines.`);
      if (folder !== layer && !existsSync(path.join(folder, 'index.ts')))
        errors.push(`${rel(folder)}: missing index.ts, its only public surface.`);
    }
  }

  const brief = path.join(root, 'docs/AGENT_BRIEF.md');
  if (readFileSync(brief).length > limits.briefBytes)
    errors.push(`docs/AGENT_BRIEF.md: over ${limits.briefBytes} bytes.`);
  for (const spec of walk(path.join(root, 'docs/phases'), (f) => f.endsWith('.md')))
    if (readFileSync(spec).length > limits.specBytes)
      errors.push(`${rel(spec)}: over ${limits.specBytes} bytes (two pages).`);
  return errors;
}

if (isMain(import.meta.url)) {
  const errors = checkLimits();
  if (errors.length) {
    process.stderr.write(errors.join('\n') + '\n');
    process.exitCode = 1;
  } else process.stdout.write('Size limits passed.\n');
}
