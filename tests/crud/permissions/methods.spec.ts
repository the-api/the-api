import { expect, test, describe } from 'bun:test';
import { testClient } from '../../lib';

const roles = {
  root: ['*'],
  admin: ['_.registered', 'testNews.*', 'testNewsDeletedProtected.*'],
  manager: ['_.registered', 'testNews.delete', 'testNewsDeletedProtected.delete'],
  registered: ['testNews.get', 'testNewsDeletedProtected.get'],
};

const migrationDirs = ['./tests/migrations'];

const crudParams = [
  {
    table: 'testNews',
    permissions: { methods: ['*'] },
  },
  {
    table: 'testNews',
    prefix: 'testNewsDeletedProtected',
    permissions: { methods: ['DELETE'] },
  },
];

const { client, tokens } = await testClient({
  migrationDirs,
  crudParams,
  roles,
});

describe('protected methods', () => {
  describe('all protected', () => {
    describe('root token create/get', () => {
      test('create testNews', async () => {
        await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' }, tokens.root);
        await client.post('/testNews', { name: 'test112' }, tokens.root);
      });

      test('GET /testNews', async () => {
        const { result, meta } = await client.get('/testNews?_sort=id', tokens.root);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNews/1', async () => {
        const { result } = await client.get('/testNews/2', tokens.root);
        expect(result.name).toEqual('test112');
      });
    });

    describe('admin token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNews', { name: 'test333' }, tokens.admin);
        expect(result.name).toEqual('test333');
      });

      test('GET /testNews', async () => {
        const { result, meta } = await client.get('/testNews?_sort=id', tokens.admin);
        expect(meta.total).toEqual(3);
        expect(result[0].name).toEqual('test111');
      });
    });

    describe('registered token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNews', { name: 'test222' }, tokens.registered);
        expect(result.name).toEqual('ACCESS_DENIED');
      });

      test('GET /testNews', async () => {
        const { result, meta } = await client.get('/testNews?_sort=id', tokens.registered);
        expect(meta.total).toEqual(3);
        expect(result[0].name).toEqual('test111');
      });
    });

    describe('unknown token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNews', { name: 'test222' }, tokens.unknown);
        expect(result.name).toEqual('ACCESS_DENIED');
      });

      test('GET /testNews', async () => {
        const { result } = await client.get('/testNews?_sort=id', tokens.unknown);
        expect(result.name).toEqual('ACCESS_DENIED');
      });
    });

    describe('no token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNews', { name: 'test222' }, tokens.noToken);
        expect(result.name).toEqual('ACCESS_DENIED');
      });

      test('GET /testNews', async () => {
        const { result } = await client.get('/testNews?_sort=id', tokens.noToken);
        expect(result.name).toEqual('ACCESS_DENIED');
      });
    });

    test('trunicate tables', async () => {
      await client.truncateTables('testNews');
    });
  });

  describe('deleted protected', () => {
    describe('root token create/get/delete', () => {
      test('create testNews', async () => {
        await client.post('/testNewsDeletedProtected', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' }, tokens.root);
        await client.post('/testNewsDeletedProtected', { name: 'test112' }, tokens.root);
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result, meta } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.root);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.get('/testNewsDeletedProtected/5', tokens.root);
        expect(result.name).toEqual('test112');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/5', tokens.root);
        expect(result.ok).toEqual(true);
      });
    });

    describe('admin token create/get/delete', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test333' }, tokens.admin);
        expect(result.name).toEqual('test333');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result, meta } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.admin);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/6', tokens.admin);
        expect(result.ok).toEqual(true);
      });
    });

    describe('manager token create/get/delete', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test333' }, tokens.manager);
        expect(result.name).toEqual('test333');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result, meta } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.manager);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/7', tokens.manager);
        expect(result.ok).toEqual(true);
      });
    });

    describe('registered token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test222' }, tokens.registered);
        expect(result.name).toEqual('test222');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result, meta } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.registered);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/8', tokens.registered);
        expect(result.error).toEqual(true);
      });
    });

    describe('unknown token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test222' }, tokens.unknown);
        expect(result.name).toEqual('test222');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.unknown);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/8', tokens.registered);
        expect(result.error).toEqual(true);
      });
    });

    describe('no token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test444' }, tokens.noToken);
        expect(result.name).toEqual('test444');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result } = await client.get('/testNewsDeletedProtected?_sort=-id', tokens.noToken);
        expect(result[0].name).toEqual('test444');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/8', tokens.registered);
        expect(result.error).toEqual(true);
      });
    });

    test('trunicate tables', async () => {
      await client.truncateTables('testNews');
    });
  });
});
