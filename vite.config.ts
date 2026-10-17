import { defineConfig } from 'vite';

export default defineConfig({
  worker: { format: 'es' },
  // Phaser 4 alone is about 1.4 MB minified; the default 500 kB warning would fire on every build.
  build: { chunkSizeWarningLimit: 1600 },
});
