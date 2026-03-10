import { describe, expect, test } from 'bun:test';
import { Routings, TheAPI, csrf } from '../src';

const router = new Routings();

router.post('/csrf', async (c) => {
  c.set('result', { ok: true });
});

const defaultApi = new TheAPI({ routings: [router] });
defaultApi.app.use('*', csrf());

const trustedOriginApi = new TheAPI({ routings: [router] });
trustedOriginApi.app.use('*', csrf({ origin: 'https://app.example.com' }));

describe('csrf', () => {
  test('init', async () => {
    await defaultApi.init();
    await trustedOriginApi.init();
  });

  test('POST /csrf allows same-origin form request', async () => {
    const res = await defaultApi.app.fetch(
      new Request('http://localhost:7788/csrf', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:7788',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'title=test',
      }),
    );

    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.result).toEqual({ ok: true });
  });

  test('POST /csrf rejects cross-site form request', async () => {
    const res = await defaultApi.app.fetch(
      new Request('http://localhost:7788/csrf', {
        method: 'POST',
        headers: {
          Origin: 'https://evil.example.com',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Sec-Fetch-Site': 'cross-site',
        },
        body: 'title=test',
      }),
    );

    const body = await res.json();

    expect(res.status).toEqual(403);
    expect(body.error).toEqual(true);
    expect(body.result.status).toEqual(403);
    expect(body.result.name).toEqual('Forbidden');
  });

  test('POST /csrf allows configured origin', async () => {
    const res = await trustedOriginApi.app.fetch(
      new Request('http://localhost:7788/csrf', {
        method: 'POST',
        headers: {
          Origin: 'https://app.example.com',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Sec-Fetch-Site': 'cross-site',
        },
        body: 'title=test',
      }),
    );

    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.result).toEqual({ ok: true });
  });
});
