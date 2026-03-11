import { describe, expect, test } from 'bun:test';
import { createRoutings, testClient } from './lib';
import type { Next } from 'hono';
import type { AppContext } from '../src';

const router = createRoutings({});

router.get('/', async (c: AppContext, n: Next) => {
  await n();
  c.set('result', {...c.var.result, e11: 'Hi11'});
});

router.get('/', async (c: AppContext) => {
  c.set('result', {e22: 'Hi22'});
});

router.post('/post/:id', async (c: AppContext) => {
  const body = await c.req.json();
  c.set('result', {...c.req.param(), ...body});
});

router.get('/search/:search', async (c: AppContext) => {
  c.set('result', c.req.param());
});

const { theAPI, client } = await testClient({ routings: [router] });

describe('Core Dist', () => {
  test('init', async () => {
    await theAPI.init();
  });
  test('GET /', async () => {
    const { result } = await client.get('/');
    expect(result).toEqual({ e11:'Hi11', e22:'Hi22' });
  });

  test('POST /post/12', async () => {
    const { result } = await client.post('/post/12', { test: true, data: { test: false, arr: [1, 'a'] } });
    expect(result).toEqual({ id: '12', test: true, data: { test: false, arr: [1, 'a'] } });
  });

  test('GET /search/4', async () => {
    const { result } = await client.get('/search/world4');
    expect(result).toEqual({ search: 'world4' });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
