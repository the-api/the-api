import { describe, expect, test } from 'bun:test';
import { createRoutings, testClient } from './lib';
import { csrf } from '../src';

const defaultRouter = createRoutings();
defaultRouter.post('/csrf', async (c) => {
  c.set('result', { ok: true });
});

const { theAPI: defaultApi } = await testClient({
  routings: [defaultRouter],
  beforeInit: (theAPI) => {
    theAPI.app.use('*', csrf());
  },
});

const trustedOriginRouter = createRoutings();
trustedOriginRouter.post('/csrf', async (c) => {
  c.set('result', { ok: true });
});

const { theAPI: trustedOriginApi } = await testClient({
  routings: [trustedOriginRouter],
  beforeInit: (theAPI) => {
    theAPI.app.use('*', csrf({ origin: 'https://app.example.com' }));
  },
});

describe('csrf', () => {
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
