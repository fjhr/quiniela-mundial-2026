// Overwrites dist/wrangler.json after @cloudflare/vite-plugin generates it.
// The plugin defaults to SSR mode, but this is a pure client-side React SPA.
// Assets-only config makes Cloudflare Workers serve static files directly.
import { writeFileSync } from 'fs';

const config = {
  name: 'mundial2026',
  compatibility_date: '2024-01-01',
  assets: {
    directory: '.',
    not_found_handling: 'single-page-application',
  },
};

writeFileSync('dist/wrangler.json', JSON.stringify(config, null, 2));
console.log('✓ dist/wrangler.json → static assets mode (no SSR)');
