import { defineConfig } from 'vite';
import { buildVersion } from './tools/version.ts';

export default defineConfig({
  worker: { format: 'es' },
  // The version stamp in the top bar (src/ui/version.ts).
  define: { __BUILD__: JSON.stringify(buildVersion(import.meta.dirname)) },
  build: {
    // Phaser 4 alone is about 1.4 MB minified; the default 500 kB warning would fire on every build.
    chunkSizeWarningLimit: 1600,
    // The Story Generator package (V-031) runs only in the worker. Its modules have no side effects,
    // so the page's bundle drops them when it imports a worker constant.
    rolldownOptions: {
      treeshake: {
        moduleSideEffects: (id: string) => !id.includes('/node_modules/story-generator/'),
      },
    },
  },
});
