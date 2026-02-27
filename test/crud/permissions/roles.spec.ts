import { expect, test, describe } from 'bun:test';
import { roles } from 'the-api-roles';
import { Routings, TheAPI } from '../../../src';
import { getTestClient } from '../../lib';

roles.init({
  root: ['*'],
  admin: ['_.registered', 'users.getFullInfo', 'users.editEmail', 'testNews.*'],
  registered: ['testNews.get', 'users.get'],
});

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({
  table: 'testNews',

  hiddenFields: ['password', 'salt'], // they're hidden everywhere and 're also readonly
  readOnlyFields: ['roles', 'email', 'emailToChange'],

  permissions: {
    protectedMethods: ['*'], // => create permissions: S(table || prefix).[get|post|patch|put|delete]
    owner: ['users.delete', 'users.getFullInfo', 'users.editEmail'],

    fields: {
      viewable: {
        'users.getFullInfo': ['email', 'emailToChange', 'externalProfiles', 'deleted'],
      },
      editable: {
        'users.editEmail': ['email'],
        'users.editRoles': ['roles'],
      },
    }
  },
});

const theAPI = new TheAPI({ roles, routings: [router] });
const client = await getTestClient(theAPI);

const rootToken = client.generateGWT({ id: 1, roles: ['root'] });
const adminToken = client.generateGWT({ id: 2, roles: ['admin'] });
const registeredToken = client.generateGWT({ id: 3, roles: ['registered'] });
const unknownToken = client.generateGWT({ id: 4, roles: ['unknown'] });
const noToken = client.generateGWT({ id: 5 });

describe('Roles', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
    });

  describe('root token create/get', () => {
    test('create testNews', async () => {
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' }, rootToken);
      await client.post('/testNews', { name: 'test112' }, rootToken);
    });

    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', rootToken);
      expect(meta.total).toEqual(2);
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', rootToken);
      expect(result.name).toEqual('test112');
    });
  });

  describe('admin token create/get', () => {
    test('create testNews', async () => {
      const { result } = await client.post('/testNews', { name: 'test333' }, adminToken);
      expect(result.name).toEqual('test333');
    });

    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', adminToken);
      expect(meta.total).toEqual(3);
      expect(result[0].name).toEqual('test111');
    });
  });

  describe('registered token create/get', () => {
    test('create testNews', async () => {
      const { result } = await client.post('/testNews', { name: 'test222' }, registeredToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });

    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', registeredToken);
      expect(meta.total).toEqual(3);
      expect(result[0].name).toEqual('test111');
    });
  });

  describe('unknown token create/get', () => {
    test('create testNews', async () => {
      const { result } = await client.post('/testNews', { name: 'test222' }, unknownToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });

    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id', unknownToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });
  });

  describe('no token create/get', () => {
    test('create testNews', async () => {
      const { result } = await client.post('/testNews', { name: 'test222' }, noToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });

    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id', noToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
