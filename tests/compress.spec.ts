import { describe, expect, test } from 'bun:test';
import { Routings, TheAPI, compress } from '../src';

const router = new Routings();

router.get('/compress', async (c) => {
  c.set('result', { data: 'x'.repeat(2048) });
});

const theAPI = new TheAPI({ routings: [router] });
theAPI.app.use('*', compress({ threshold: 1 }));

describe('compress', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('GET /compress adds content-encoding for compressible responses', async () => {
    const res = await theAPI.app.fetch(
      new Request('http://localhost:7788/compress', {
        method: 'GET',
        headers: {
          'Accept-Encoding': 'gzip',
        },
      }),
    );

    expect(res.status).toEqual(200);
    expect(res.headers.get('content-encoding')).toEqual('gzip');
  });
});
