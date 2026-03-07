import { describe, expect, test } from 'bun:test';
import { getTestClient } from './lib';
import { TheAPI } from '../src';
import { info, logs, status } from '../src/middlewares';

const theAPI = new TheAPI({ routings: [logs, status, info] });
const client = await getTestClient(theAPI);

describe('info', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('GET /status', async () => {
    const { result } = await client.get('/status');

    expect(result.ok).toEqual(1);
  });

  test('GET /info', async () => {
    const { result } = await client.get('/info');

    expect(result.totalRequests).toEqual(1);
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});