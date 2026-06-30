// Serve static assets only — no SSR, pure client-side React SPA
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Rewrite root to index.html for SPA
    if (url.pathname === '/' || url.pathname === '/quiniela-mundial-2026') {
      url.pathname = '/quiniela-mundial-2026/';
    }
    const response = await env.ASSETS.fetch(new Request(url.toString(), request));
    // SPA fallback: serve index.html for unknown routes
    if (response.status === 404) {
      return env.ASSETS.fetch(new Request(new URL('/quiniela-mundial-2026/index.html', request.url).toString(), request));
    }
    return response;
  }
};
