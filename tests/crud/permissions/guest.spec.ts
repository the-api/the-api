import { expect, test, describe } from 'bun:test';
import { testClient } from '../../lib';

const roles = {
  root: ['*'],
  guest: ['testNews.get'],
};

const { client, tokens } = await testClient({
  migrationDirs: ['./tests/migrations'],
  crudParams: [{
    table: 'testNews',
    permissions: { methods: ['*'] },
  }],
  roles,
});

describe('guest role', () => {
  test('GET /testNews is allowed without token for guest role', async () => {
    await client.post('/testNews', { name: 'guest-1' }, tokens.root);
    await client.post('/testNews', { name: 'guest-2' }, tokens.root);

    const { result, meta } = await client.get('/testNews?_sort=id');
    expect(meta.total).toEqual(2);
    expect(result[0].name).toEqual('guest-1');
  });

  test('POST /testNews is denied without token when guest has only get', async () => {
    const { result } = await client.post('/testNews', { name: 'guest-post-denied' });
    expect(result.name).toEqual('ACCESS_DENIED');
  });

  test('token without roles is not treated as guest', async () => {
    const { result } = await client.get('/testNews?_sort=id', tokens.noRole);
    expect(result.name).toEqual('ACCESS_DENIED');
  });
});
