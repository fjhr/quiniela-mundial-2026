import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages needs subdirectory base; Cloudflare Workers serves from root
  base: process.env.GITHUB_ACTIONS ? '/quiniela-mundial-2026/' : '/',
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
});
