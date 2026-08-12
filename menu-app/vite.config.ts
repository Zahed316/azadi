import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Vite plugin that injects a <link rel="preload"> for the Vazirmatn body
 * font into index.html after build. The font filename is content-hashed by
 * Vite, so we scan the built CSS to find the woff2 URL at build time.
 */
function injectFontPreload() {
  return {
    name: 'inject-font-preload',
    apply: 'build',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      const assetsDir = resolve(dist, 'assets');

      // Find the main CSS file (index-*.css)
      let cssFile: string | undefined;
      try {
        cssFile = readdirSync(assetsDir).find((f) => f.startsWith('index-') && f.endsWith('.css'));
      } catch {
        return;
      }
      if (!cssFile) return;

      const css = readFileSync(resolve(assetsDir, cssFile), 'utf-8');
      const match = css.match(/url\([^)]*vazirmatn-arabic-400[^)]*\.woff2\)/);
      if (!match) return;
      const urlMatch = match[0].match(/url\(([^)]+)\)/);
      if (!urlMatch) return;
      // CSS urls are absolute (/assets/...) — use directly
      const fontPath = urlMatch[1];

      const htmlPath = resolve(dist, 'index.html');
      const html = readFileSync(htmlPath, 'utf-8');
      const preloadTag = `<link rel="preload" href="${fontPath}" as="font" type="font/woff2" crossorigin>`;
      const updated = html.replace('</head>', `  ${preloadTag}\n</head>`);
      writeFileSync(htmlPath, updated);
    },
  };
}

export default defineConfig({
  plugins: [react(), injectFontPreload()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
