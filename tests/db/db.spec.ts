import { expect, test, describe } from 'bun:test';
import { testClient } from '../lib';
import type { AppContext, TestClientOptionsType } from '../../src';

const newRoutings: NonNullable<TestClientOptionsType['newRoutings']> = (router) => {
  router.get('/check-migration', async (c: AppContext) => {
    await c.var.dbWrite('testNews').insert({ name: 'test' });
    c.set('result', await c.var.db('testNews'));
  });
};

const { client } = await testClient({
  migrationDirs: ['./tests/migrations'],
  newRoutings,
});

describe('DB', async () => {

  test('GET /check-migration', async () => {
    const { result } = await client.get('/check-migration');
    expect(result[0].name).toEqual('test');
  });
});
