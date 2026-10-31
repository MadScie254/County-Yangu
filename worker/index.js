// Cloudflare Worker in front of the static site. Files that exist are served as they are (with the headers from
// public/_headers). Anything else is a page inside one of the two single-page apps, so it gets that app's index.html:
// /console/... belongs to the staff app, everything else to the resident app.
// The shells are asked for as "/" and "/console/", never ".../index.html": the asset store answers an index.html URL
// with a redirect to the folder, which would send every deep link (a shared case, /promises) to the home page.
// A missing file under /assets/ stays a 404, so a stale script reference fails plainly instead of loading a page.
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404 || (request.method !== 'GET' && request.method !== 'HEAD')) return res;
    const url = new URL(request.url);
    if (url.pathname.startsWith('/assets/')) return res;
    const shell = url.pathname === '/console' || url.pathname.startsWith('/console/') ? '/console/' : '/';
    return env.ASSETS.fetch(new Request(new URL(shell, url), request));
  },
};
