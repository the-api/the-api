import { describe, expect, test } from 'bun:test';
import { Routings, TheAPI, etag } from '../src';

const router = new Routings();

router.get('/etag', async (c) => {
  c.header('ETag', '"etag-v1"');
  c.set('result', { ok: true, version: 1 });
});

const theAPI = new TheAPI({ routings: [router] });
theAPI.app.use('*', etag());

describe('etag', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('GET /etag returns ETag header', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/etag'),
    );

    expect(res.status).toEqual(200);
    expect(res.headers.get('etag')).toBeTruthy();
  });

  test('GET /etag returns 304 when If-None-Match matches stable ETag', async () => {
    const firstRes = await theAPI.app.fetch(
      new Request('http://localhost:7788/etag'),
    );
    const etagHeader = firstRes.headers.get('etag');

    expect(etagHeader).toBeTruthy();

    const secondRes = await theAPI.app.fetch(
      new Request('http://localhost:7788/etag', {
        headers: {
          'If-None-Match': etagHeader || '',
        },
      }),
    );

    expect(secondRes.status).toEqual(304);
    expect(secondRes.headers.get('etag')).toEqual(etagHeader);
  });
});
