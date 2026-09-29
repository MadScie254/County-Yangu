/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// Two doors, one project: `/` is the resident app (County Yangu), `/console` is the staff app
// (CountyConnect). They are separate bundles, so staff code is never shipped to residents' phones,
// and either can be served from its own hostname.
function spaFallback(): Plugin {
  return {
    name: 'county-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '/';
        const path = url.split('?')[0] ?? '/';
        const isAsset = path.includes('.') || path.startsWith('/@') || path.startsWith('/node_modules') || path.startsWith('/src/');
        if (!isAsset) req.url = (path === '/console' || path.startsWith('/console/') ? '/console/index.html' : '/index.html') + (url.includes('?') ? url.slice(url.indexOf('?')) : '');
        next();
      });
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  // maplibre-gl v6 spawns its worker from a sibling module URL, which breaks if the dev optimiser inlines it.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  build: {
    target: 'es2022',
    sourcemap: true,
    rolldownOptions: {
      input: {
        resident: resolve(import.meta.dirname, 'index.html'),
        console: resolve(import.meta.dirname, 'console/index.html'),
      },
    },
  },
  server: { host: true, port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}', 'tests/functions/*.test.ts'],
    css: false,
  },
});
