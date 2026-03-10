import { describe, expect, test } from 'bun:test';
import { Routings, TheAPI, bodyLimit } from '../src';

const router = new Routings();

router.post('/body-limit', async (c) => {
  await c.req.text();
  c.set('result', { ok: true });
});

const theAPI = new TheAPI({ routings: [router] });
theAPI.app.use('*', bodyLimit({ maxSize: 5 }));

describe('bodyLimit', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('POST /body-limit rejects payloads larger than maxSize', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/body-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: '123456',
      }),
    );

    const body = await res.json();

    expect(res.status).toEqual(413);
    expect(body.error).toEqual(true);
    expect(body.result.status).toEqual(413);
    expect(body.result.name).toEqual('Payload Too Large');
  });

  test('POST /body-limit allows payloads within maxSize', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/body-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: '12345',
      }),
    );

    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.result).toEqual({ ok: true });
  });
});
