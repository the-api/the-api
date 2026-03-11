import { expect, test, describe } from 'bun:test';
import { testClient } from '../../lib';

const roles = {
  root: ['*'],
  admin: ['users.delete'],
};

const { theAPI, client } = await testClient({
  routingOptions: { migrationDirs: ['./tests/migrations'] },
  crudParams: [{
    table: 'testTypes',
    prefix: 'users',
  }],
  roles,
});
const { tokens } = client;

describe('auto protected methods', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  });

  test('POST /users is not protected when only users.delete exists in roles', async () => {
    const { result } = await client.post('/users', { name: 'auto-method-1' }, tokens.noToken);
    expect(result.name).toEqual('auto-method-1');
  });

  test('GET /users is not protected when only users.delete exists in roles', async () => {
    const { meta } = await client.get('/users?_sort=id', tokens.noToken);
    expect(meta.total).toBeGreaterThanOrEqual(1);
  });

  test('DELETE /users/:id is protected automatically', async () => {
    const { result: created } = await client.post('/users', { name: 'auto-method-2' }, tokens.noToken);

    const denied = await client.delete(`/users/${created.id}`, tokens.noToken);
    expect(denied.result.name).toEqual('ACCESS_DENIED');

    const { result: adminDeleted } = await client.delete(`/users/${created.id}`, tokens.admin);
    expect(adminDeleted.ok).toEqual(true);
  });

  test('finalize', async () => {
    await client.truncateTables('testTypes');
  });
});
