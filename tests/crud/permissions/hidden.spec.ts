import { expect, test, describe, beforeAll } from 'bun:test';
import { testClient } from '../../lib';

const migrationDirs = ['./tests/migrations'];

const roles = {
  root: ['*'],
  admin: ['testNews.getFullInfo'],
  manager: ['_.registered'],
  registered: ['testNews.getViews'],
  owner: ['testNews.getFullInfo'], // virtual role, resolved per record
};

const crudParams = [{
  table: 'testNews',
  fieldRules: {
    hidden: ['timeCreated', 'views'],
    visibleFor: {
      'testNews.getFullInfo': ['timeCreated', 'views'],
      'testNews.getViews': ['views'],
    },
  },
}];

const { client, tokens, users, DateTime } = await testClient({
  crudParams,
  migrationDirs,
  roles,
});

describe('Hidden', () => {
  beforeAll(async () => {
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' }, tokens.root);
      await client.post('/testNews', { name: 'test112', views: 100, timeCreated: DateTime.fromISO('2024-06-01').toString() }, tokens.root);
  });

  describe('root token', () => {
    test('GET /testNews by nobody', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id');

      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).toEqual(undefined);
    });

    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.root);

      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).not.toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.root);
      expect(result.views).not.toEqual(undefined);
    });
  });

  describe('admin', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.admin);
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).not.toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.admin);
      expect(result.views).not.toEqual(undefined);
    });
  });

  describe('registered', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.registered);
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.registered);
      expect(result.views).not.toEqual(undefined);
    });
  });

  describe('manager', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.manager);
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.manager);
      expect(result.views).not.toEqual(undefined);
    });
  });

  describe('no role', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.noRole);
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.noRole);
      expect(result.views).toEqual(undefined);
    });
  });

  describe('no token', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id');
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2');
      expect(result.views).toEqual(undefined);
    });
  });

  describe('owner', () => {
    test('create testNews', async () => {
      await client.post(
        '/testNews',
        { userId: users.noRole.id, name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' },
        tokens.noRole,
      );
      await client.post(
        '/testNews',
        { userId: users.noRole.id, name: 'test112', views: 100, timeCreated: DateTime.fromISO('2024-06-01').toString() },
        tokens.noRole,
      );
    });

    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=-id', tokens.noRole);
      expect(meta.total).toEqual(4);
      expect(result[0].views).not.toEqual(undefined);
    });

    test('GET /testNews/3', async () => {
      const { result } = await client.get('/testNews/3', tokens.noRole);
      expect(result.timeCreated).not.toEqual(undefined);
      expect(result.views).not.toEqual(undefined);
    });

    test('GET /testNews/3 by nobody', async () => {
      const { result } = await client.get('/testNews/3');
      expect(result.timeCreated).toEqual(undefined);
      expect(result.views).toEqual(undefined);
    });
  });
});
