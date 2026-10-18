// The engine for Node tools, loaded once through Vite's module runner: the region reads the Story
// Generator package (V-031), whose TypeScript source Node won't strip inside node_modules.
import { runnerImport } from 'vite';
import { root } from './lib.mjs';

const { module } = await runnerImport(`${root}tools/engine-entry.ts`, {
  root,
  configFile: false,
  logLevel: 'error',
});
export const engine = module;
