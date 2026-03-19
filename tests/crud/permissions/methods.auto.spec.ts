import { expect, test, describe } from 'bun:test';
import { testClient } from '../../lib';

const roles = {
  root: ['*'],
  admin: ['users.delete'],
  owner: ['users.patch', 'users.delete'],
};

describe('auto protected methods', async () => {
  const { client } = await testClient({
    routingOptions: { migrationDirs: ['./tests/migrations'] },
    crudParams: [{
      table: 'testTypesUsers',
      prefix: 'users',
    }],
    roles,
  });
  const { tokens } = client;

  test('POST /users is not protected when only users.delete exists in roles', async () => {
    const { result } = await client.post('/users', { name: 'auto-method-1' }, tokens.noToken);
    expect(result.name).toEqual('auto-method-1');
  });

  test('GET /users is not protected when only users.delete exists in roles', async () => {
    const { meta } = await client.get('/users?_sort=id', tokens.noToken);
    expect(meta.total).toBeGreaterThanOrEqual(1);
  });

  test('DELETE /users/:id is protected automatically', async () => {
    const { result: created } = await client.post('/users', { name: 'auto-method-2' }, tokens.registered);

    const denied = await client.delete(`/users/${created.id}`);

    expect(denied.result.name).toEqual('ACCESS_DENIED');

    const { result: adminDeleted } = await client.delete(`/users/${created.id}`, tokens.admin);
    expect(adminDeleted.ok).toEqual(true);
  });

  test('owner can PATCH and DELETE own record', async () => {
    const { result: created } = await client.post(
      '/users',
      { name: 'owner-record', userId: client.users.noRole.userId as number },
      tokens.noRole,
    );

    const patched = await client.patch(
      `/users/${created.id}`,
      { name: 'owner-record-updated' },
      tokens.noRole,
    );
    expect(patched.result.name).toEqual('owner-record-updated');

    const deleted = await client.delete(`/users/${created.id}`, tokens.noRole);
    expect(deleted.result.ok).toEqual(true);
  });
});
