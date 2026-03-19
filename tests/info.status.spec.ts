import { describe, expect, test } from 'bun:test';
import { testClient } from './lib';
import { info, logs, status } from '../src/middlewares';

const { client } = await testClient({ routings: [logs, status, info] });

describe('info', () => {

  test('GET /status', async () => {
    const { result } = await client.get('/status');

    expect(result.ok).toEqual(1);
  });

  test('GET /info', async () => {
    const { result } = await client.get('/info');

    expect(result.totalRequests >= 1).toEqual(true);
  });
});
