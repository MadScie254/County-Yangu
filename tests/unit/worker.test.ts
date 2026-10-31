// @vitest-environment node
import { describe, expect, it } from 'vitest';
import worker from '../../worker/index.js';

// A stand-in for the Cloudflare asset store with its default HTML handling: a folder URL serves its index.html,
// an index.html URL is redirected to its folder, and anything else that is not a file is a 404.
const files: Record<string, string> = {
  '/index.html': 'resident shell',
  '/console/index.html': 'staff shell',
  '/assets/resident-abc.js': 'code',
};
const assets = {
  async fetch(req: Request) {
    const { pathname } = new URL(req.url);
    if (pathname.endsWith('/index.html')) return new Response(null, { status: 307, headers: { location: pathname.slice(0, -10) || '/' } });
    if (pathname === '/console') return new Response(null, { status: 307, headers: { location: '/console/' } });
    const body = files[pathname.endsWith('/') ? `${pathname}index.html` : pathname];
    return body === undefined ? new Response('not found', { status: 404 }) : new Response(body, { status: 200 });
  },
};
const get = async (path: string, method = 'GET') => {
  const res = await worker.fetch(new Request(`https://county.example${path}`, { method }), { ASSETS: assets });
  return { status: res.status, body: method === 'GET' ? await res.text() : '' };
};

describe('site worker', () => {
  it('serves the resident app for a deep link instead of redirecting to the home page', async () => {
    for (const path of ['/promises', '/case/NAI-R123', '/fixed?ward=karura', '/me']) {
      expect(await get(path)).toEqual({ status: 200, body: 'resident shell' });
    }
  });

  it('serves the staff app for any page under /console/', async () => {
    expect(await get('/console/questions')).toEqual({ status: 200, body: 'staff shell' });
    expect(await get('/console/cases/123')).toEqual({ status: 200, body: 'staff shell' });
  });

  it('serves files as they are and keeps a missing script a 404', async () => {
    expect(await get('/assets/resident-abc.js')).toEqual({ status: 200, body: 'code' });
    expect((await get('/assets/resident-old.js')).status).toBe(404);
  });

  it('does not answer other methods with a page', async () => {
    expect((await get('/promises', 'POST')).status).toBe(404);
  });
});
