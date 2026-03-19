import { describe, expect, test } from 'bun:test';
import { createRoutings, testClient } from './lib';
import { compress } from '../src';

const router = createRoutings();
router.get('/compress', async (c) => {
  c.set('result', { data: 'x'.repeat(2048) });
});

const { theAPI } = await testClient({
  routings: [router],
  beforeInit: (theAPI) => {
    theAPI.app.use('*', compress({ threshold: 1 }));
  },
});

describe('compress', () => {

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
