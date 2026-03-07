import { describe, expect, test } from 'bun:test';
import { getTestClient } from './lib';
import { Routings, TheAPI } from '../src';
import type { Context, Next } from 'hono';

const router = new Routings();

router.get('/', async (c: Context, n: Next) => {
  await n();
  c.set('result', {...c.var.result, e11: 'Hi11'});
});

router.get('/', async (c: Context) => {
  c.set('result', {e22: 'Hi22'});
});

router.post('/post/:id', async (c: Context) => {
  const body = await c.req.json();
  c.set('result', {...c.req.param(), ...body});
});

router.get('/search/:search', async (c: Context) => {
  c.set('result', c.req.param());
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('Core', () => {
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
