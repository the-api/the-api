import { expect, test, describe, beforeAll } from 'bun:test';
import { testClient } from '../lib';

const { client } = await testClient({
  migrationDirs: ['./tests/migrations'],
  crudParams: [
    {
      table: 'testTypes',
    },
    {
      table: 'testTypes',
      prefix: 'testTypesWithDeleted',
      includeDeleted: true,
      deletedReplacements: {
        name: 'Deleted News',
      },
    },
    {
      table: 'testNews',
    },
    {
      table: 'testNews',
      prefix: 'testNewsWithDeleted',
      includeDeleted: true,
      deletedReplacements: {
        name: 'Deleted News',
      },
    },
  ],
});

describe('GET deleted', () => {
  beforeAll(async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()', isDeleted: true });
      await client.post('/testNews', { name: 'test112' });
  });

  describe('check deleted was hidden', () => {
    test('GET /testTypes', async () => {
      const { meta } = await client.get('/testTypes?_sort=id');
      expect(meta.total).toEqual(2);
    });

    test('DELETE /testTypes/1', async () => {
      const { result, ...a } = await client.delete('/testTypes/1');
      expect(result.ok).toEqual(true);
    });

    test('GET /testTypes', async () => {
      const { meta } = await client.get('/testTypes?_sort=id');
      expect(meta.total).toEqual(1);
    });

    test('GET /testTypes/1', async () => {
      const { result } = await client.get('/testTypes/1');
      expect(result.error).toEqual(true);
    });
  });

  describe('check with deleted', () => {
    test('GET /testTypesWithDeleted', async () => {
      const { result, meta } = await client.get('/testTypesWithDeleted?_sort=id');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('type2');
    });

    test('GET /testTypesWithDeleted/1', async () => {
      const { result } = await client.get('/testTypesWithDeleted/1');
      expect(result.error).toEqual(true);
    });
  });

  describe('isDeleted: check deleted was hidden', () => {
    test('GET /testNews', async () => {
      const { meta } = await client.get('/testNews?_sort=id');
      expect(meta.total).toEqual(2);
    });

    test('DELETE /testNews/1', async () => {
      const { result } = await client.delete('/testNews/1');
      expect(result.ok).toEqual(true);
    });

    test('GET /testNews', async () => {
      const { meta } = await client.get('/testNews?_sort=id');
      expect(meta.total).toEqual(1);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/1');
      expect(result.error).toEqual(true);
    });
  });

  describe('isDeleted: check with deleted', () => {
    test('GET /testNewsWithDeleted', async () => {
      const { result } = await client.get('/testNewsWithDeleted?_sort=id');
      expect(result[0].isDeleted).toEqual(true);
      expect(result[0].name).toEqual('Deleted News');
      expect(result[1].isDeleted).toEqual(false);
    });

    test('GET /testNewsWithDeleted/1', async () => {
      const { result } = await client.get('/testNewsWithDeleted/1');
      expect(result.isDeleted).toEqual(true);
      expect(result.name).toEqual('Deleted News');
    });
  });
});
