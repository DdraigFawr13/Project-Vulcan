import { defineConfig } from 'vite';

export default defineConfig({
  worker: { format: 'es' },
  // Phaser alone is about 1.2 MB minified; the default 500 kB warning would fire on every build.
  build: { chunkSizeWarningLimit: 1600 },
});
