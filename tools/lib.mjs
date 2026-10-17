// Small file helpers shared by the tools/ checks.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const rel = (file) => path.relative(root, file).split(path.sep).join('/');

export function walk(directory, keep = () => true) {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, keep));
    else if (keep(full)) out.push(full);
  }
  return out.sort();
}

export const dirs = (directory) =>
  readdirSync(directory, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(directory, e.name))
    .sort();

export const size = (file) => {
  try {
    return statSync(file).size;
  } catch {
    return null;
  }
};

export const isMain = (url) =>
  process.argv[1] && fileURLToPath(url) === path.resolve(process.argv[1]);
