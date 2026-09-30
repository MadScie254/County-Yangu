// Cloudflare Worker in front of the static site. Files that exist are served as they are (with the headers from
// public/_headers). Anything else is a page inside one of the two single-page apps, so it gets that app's index.html:
// /console/... belongs to the staff app, everything else to the resident app.
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404 || (request.method !== 'GET' && request.method !== 'HEAD')) return res;
    const url = new URL(request.url);
    const shell = url.pathname === '/console' || url.pathname.startsWith('/console/') ? '/console/index.html' : '/index.html';
    return env.ASSETS.fetch(new Request(new URL(shell, url), request));
  },
};
