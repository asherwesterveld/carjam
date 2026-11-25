import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Generates static /print/index.html and /404.html copies of index.html
 * so direct visits to https://carjam.asherwesterveld.com/print return HTTP 200 on GitHub Pages.
 */
function staticRoutesPlugin() {
  return {
    name: 'static-routes-plugin',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const indexHtml = resolve(distDir, 'index.html');
      const printDir = resolve(distDir, 'print');
      mkdirSync(printDir, { recursive: true });
      copyFileSync(indexHtml, resolve(printDir, 'index.html'));
      copyFileSync(indexHtml, resolve(distDir, '404.html'));
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), staticRoutesPlugin()],
  worker: {
    format: 'es',
  },
});
