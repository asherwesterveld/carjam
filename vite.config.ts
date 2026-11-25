import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Generates static /print/index.html (with route-specific title & canonical URL)
 * and /404.html so direct visits to https://carjam.asherwesterveld.com/print
 * return HTTP 200 on GitHub Pages.
 */
function staticRoutesPlugin() {
  return {
    name: 'static-routes-plugin',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const indexHtmlPath = resolve(distDir, 'index.html');
      const printDir = resolve(distDir, 'print');
      mkdirSync(printDir, { recursive: true });

      const indexHtml = readFileSync(indexHtmlPath, 'utf8');
      const printHtml = indexHtml
        .replace(
          /<title>.*?<\/title>/,
          '<title>Car Jam — Bulk Rush Hour Card Generator &amp; Print Studio</title>'
        )
        .replace(
          'href="https://carjam.asherwesterveld.com/"',
          'href="https://carjam.asherwesterveld.com/print"'
        )
        .replace(
          'content="https://carjam.asherwesterveld.com/"',
          'content="https://carjam.asherwesterveld.com/print"'
        );

      writeFileSync(resolve(printDir, 'index.html'), printHtml, 'utf8');
      copyFileSync(indexHtmlPath, resolve(distDir, '404.html'));
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
