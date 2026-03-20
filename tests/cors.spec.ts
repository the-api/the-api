import { describe, expect, test } from 'bun:test';
import { createRoutings, testClient } from './lib';
import { cors } from '../src';

const router = createRoutings();
router.get('/cors', async (c) => {
  c.set('result', { ok: true });
});

router.post('/cors', async (c) => {
  c.set('result', c.var.body);
});

const { theAPI } = await testClient({
  routings: [router],
  beforeInit: (theAPI) => {
    theAPI.app.use('*', cors());
  },
});

describe('cors', () => {

  test('GET /cors returns CORS headers', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/cors', {
        method: 'GET',
        headers: {
          Origin: 'https://example.com',
        },
      }),
    );

    expect(res.status).toEqual(200);
    expect(res.headers.get('access-control-allow-origin')).toEqual('*');
  });

  test('OPTIONS /cors handles preflight for all methods', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/cors', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      }),
    );

    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toEqual('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });
});
