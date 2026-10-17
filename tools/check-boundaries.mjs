import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';

const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = {
  // Layers (docs/ARCHITECTURE.md "Layers"). Adapted from Story-Generator scripts/check-boundaries.mjs.
  engine: new Set(['engine']),
  content: new Set(['content', 'engine']),
  worker: new Set(['worker', 'engine', 'content']),
  render: new Set(['render', 'worker', 'content']),
  persist: new Set(['persist', 'worker']),
  ui: new Set(['ui', 'render', 'worker', 'persist', 'content']),
};
// Runtime dependencies each layer may import (SAFE-03: a new one needs Morgan's approval).
const externals = { render: new Set(['phaser']), ui: new Set(['phaser']) };
const pureLayers = new Set(['engine', 'content']);
const forbiddenCoreNames = new Set([
  'Date',
  'performance',
  'window',
  'document',
  'navigator',
  'fetch',
  'crypto',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'localStorage',
  'indexedDB',
  'globalThis',
  'process',
  'require',
  'eval',
  'Function',
  'Intl',
  'localeCompare',
  'random',
]);
// Safe math for determinism (DECISIONS V-006): transcendental Math functions can differ
// between JS engines, so the new engine and content use lookup tables instead.
const safeMathLayers = new Set(['engine', 'content']);
const unsafeMathNames = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'pow',
  'log',
  'log1p',
  'log2',
  'log10',
  'cbrt',
  'hypot',
]);

// The module a src-relative path belongs to: its layer, or layer/system when it sits in a folder.
function moduleOf(parts) {
  return parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0];
}

export function checkModule(fileName, sourceText) {
  const from = path.relative(path.join(root, 'src'), fileName).split(path.sep);
  const layer = from[0];
  if (!allowed[layer]) return [`Unknown source layer: ${fileName}`];
  const errors = [];
  const source = parse(sourceText, {
    sourceType: 'module',
    sourceFilename: fileName,
    plugins: fileName.endsWith('.tsx') ? ['typescript', 'jsx'] : ['typescript'],
  });

  function checkImport(specifier) {
    if (specifier.type !== 'StringLiteral') {
      errors.push('Computed module imports are not allowed in production source.');
      return;
    }
    // Vite suffixes such as ?worker or ?raw don't change which file is imported.
    const name = specifier.value.replace(/\?.*$/, '');
    if (!name.startsWith('.')) {
      if (!externals[layer]?.has(name))
        errors.push(`${layer} cannot import external module ${name}.`);
      return;
    }
    const target = path.relative(
      path.join(root, 'src'),
      path.resolve(path.dirname(fileName), name),
    );
    const to = target.split(path.sep);
    const destination = to[0];
    if (!allowed[layer].has(destination)) {
      errors.push(`${layer} cannot import ${destination}: ${name}.`);
      return;
    }
    // A system folder (src/<layer>/<system>/) is reached only through its index.ts (VR-44).
    // Exceptions: content data folders, and a layer's root files from inside that layer.
    const toModule = moduleOf(to);
    if (toModule === moduleOf(from) || (to[0] === 'content' && to[1] === 'data')) return;
    if (to.length === 2 && to[0] === from[0]) return;
    const depth = toModule.split('/').length + 1;
    if (to.length !== depth || to.at(-1) !== 'index.ts')
      errors.push(`Import ${toModule} through its index.ts, not ${name}.`);
  }
  function checkMath(node) {
    if (
      safeMathLayers.has(layer) &&
      node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      node.object.name === 'Math'
    ) {
      const name = node.computed
        ? node.property.type === 'StringLiteral'
          ? node.property.value
          : null
        : node.property.name;
      if (name === null) errors.push('Computed Math access is not allowed in the engine.');
      else if (name === 'random')
        errors.push('Simulation core cannot use Math.random; use a named RNG stream.');
      else if (unsafeMathNames.has(name))
        errors.push(`Engine math must be deterministic: Math.${name} is not allowed.`);
    }
  }
  function visit(node) {
    // Property names (rng.random, { process: ... }) are not globals; check only the object side.
    if (node.type === 'MemberExpression' && !node.computed) {
      checkMath(node);
      visit(node.object);
      return;
    }
    if (node.type === 'ObjectProperty' && !node.computed) {
      visit(node.value);
      return;
    }
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) &&
      node.source
    ) {
      checkImport(node.source);
    }
    if (node.type === 'TSImportType') checkImport(node.argument ?? node.source);
    if (node.type === 'ImportExpression') checkImport(node.source);
    if (node.type === 'CallExpression' && node.callee.type === 'Import') {
      if (node.arguments[0]) checkImport(node.arguments[0]);
      else errors.push('Missing module specifier.');
    }
    if (pureLayers.has(layer) && node.type === 'Identifier' && forbiddenCoreNames.has(node.name)) {
      errors.push(`Simulation core cannot use ${node.name}.`);
    }
    if (
      pureLayers.has(layer) &&
      node.type === 'MemberExpression' &&
      node.computed &&
      node.property.type === 'StringLiteral' &&
      forbiddenCoreNames.has(node.property.value)
    ) {
      errors.push(`Simulation core cannot use ${node.property.value}.`);
    }
    checkMath(node);
    if (safeMathLayers.has(layer) && node.type === 'BinaryExpression' && node.operator === '**') {
      errors.push('Engine math must be deterministic: ** is not allowed.');
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child))
        child.forEach((item) => {
          if (item?.type) visit(item);
        });
      else if (child && typeof child === 'object' && typeof child.type === 'string') visit(child);
    }
  }
  visit(source);
  return [...new Set(errors)];
}

async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await sources(name)));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) result.push(name);
  }
  return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const files = await sources(path.join(root, 'src'));
  const errors = [];
  for (const file of files) {
    errors.push(
      ...checkModule(file, await readFile(file, 'utf8')).map(
        (error) => `${path.relative(root, file)}: ${error}`,
      ),
    );
  }
  if (errors.length) {
    process.stderr.write(errors.join('\n') + '\n');
    process.exitCode = 1;
  } else
    process.stdout.write(`Import/runtime boundaries passed for ${files.length} source modules.\n`);
}
