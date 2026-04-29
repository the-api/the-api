import { expect, test, describe } from 'bun:test';
import Roles from 'the-api-roles';
import { testClient } from '../../lib';

const roles = new Roles({
  root: ['*'], // all permissions
  admin: [
    '_.registered',       // nested permissions: all permissions of registered role
    'users.getFullInfo',  // get full info of users
    'users.editEmail',    // edit email
    'testNews.*'          // all permissions for testNews
  ],
  registered: ['testNews.get', 'users.get'], // only get permissions for testNews and users
  owner: ['users.getFullInfo', 'users.editEmail'], // virtual role, resolved per record
});

const { client } = await testClient({
  migrationDirs: ['./tests/migrations'],
  crudParams: [{
    table: 'testNews',

    fieldRules: {
      hidden: ['password', 'salt'], // they're hidden everywhere and 're also readonly
      readOnly: ['roles', 'email', 'emailToChange'],
      visibleFor: {
        'users.getFullInfo': ['email', 'emailToChange', 'externalProfiles', 'deleted'],
      },
      editableFor: {
        'users.editEmail': ['email', 'emailToChange'],
        'users.editRoles': ['roles'],
      },
    },
    
    permissions: {
      methods: ['*'], // add permissions for all methods
      // methods: ['POST', 'PATCH', 'DELETE'], // add permissions for create, update and delete
    },
  }],
  roles,
});

const rootToken = client.generateGWT({ userId: 1, roles: ['root'] });
const adminToken = client.generateGWT({ userId: 2, roles: ['admin'] });
const registeredToken = client.generateGWT({ userId: 3, roles: ['registered'] });
const unknownToken = client.generateGWT({ userId: 4, roles: ['unknown'] });
const noToken = client.generateGWT({ userId: 5 });

describe('Roles', () => {
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
});
