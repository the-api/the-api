import { describe, expect, test } from 'bun:test';
import { createRoutings, testClient } from './lib';
import type { AppContext } from '../src';

const router = createRoutings();

router.post('/request-state/json', async (c: AppContext) => {
  c.set('result', {
    body: c.var.body,
    bodyType: c.var.bodyType,
  });
});

router.post('/request-state/text', async (c: AppContext) => {
  c.set('result', {
    body: c.var.body,
    bodyType: c.var.bodyType,
  });
});

router.post('/request-state/binary', async (c: AppContext) => {
  c.set('result', {
    bodyType: c.var.bodyType,
    byteLength: (c.var.body as ArrayBuffer).byteLength,
  });
});

const { theAPI } = await testClient({ routings: [router] });

describe('request state', () => {
  test('stores parsed json in c.var.body', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/request-state/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ok: true, items: [1, 2, 3] }),
      }),
    );

    const body = await res.json();

    expect(body.result).toEqual({
      body: { ok: true, items: [1, 2, 3] },
      bodyType: 'json',
    });
  });

  test('does not throw on malformed json and keeps safe fallback body', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/request-state/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{"broken":',
      }),
    );

    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.result).toEqual({
      body: {},
      bodyType: 'json',
    });
  });

  test('stores parsed text in c.var.body', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/request-state/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'hello world',
      }),
    );

    const body = await res.json();

    expect(body.result).toEqual({
      body: 'hello world',
      bodyType: 'text',
    });
  });

  test('stores binary body as arrayBuffer', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/request-state/binary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array([1, 2, 3, 4]),
      }),
    );

    const body = await res.json();

    expect(body.result).toEqual({
      bodyType: 'arrayBuffer',
      byteLength: 4,
    });
  });
});
