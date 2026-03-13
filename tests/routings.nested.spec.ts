import { describe, expect, test } from 'bun:test';
import { testClient } from './lib';
import { Routings } from '../src';
import { info, status } from '../src/middlewares';

const router = new Routings();

router.get('/nested', async (c) => {
  c.set('result', { ok: 1 });
});

const { theAPI, client } = await testClient({
  routings: [router, [status, info]],
});

describe('nested routings', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('registers route from top-level routing', async () => {
    const { result } = await client.get('/nested');

    expect(result.ok).toEqual(1);
  });

  test('registers route from nested routing array', async () => {
    const { result } = await client.get('/status');

    expect(result.ok).toEqual(1);
  });

  test('registers nested info middleware too', async () => {
    const { result } = await client.get('/info');

    expect(result.totalRequests >= 1).toEqual(true);
  });

  test('finalize', async () => {
    await client.deleteTables();
  });
});
