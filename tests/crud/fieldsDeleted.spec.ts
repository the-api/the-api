import { expect, test, describe } from 'bun:test';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./tests/migrations'] });

router.crud({
  table: 'testNews',
  aliases: {
    name: 'newsName',
  },
  hiddenFields: [
    'timeCreated',
    'views',
  ],
  includeDeleted: true,
  deletedReplacements: {
    name: 'Deleted News',
  },
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET fields', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()', isDeleted: true });
      await client.post('/testNews', { name: 'test112' });
    });
  });

  describe('check hidden fields', () => {
    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id');
      expect(result[0].timeCreated).toEqual(undefined);
      expect(result[0].views).toEqual(undefined);
      expect(result[0].timePublished).toBeTypeOf('string');
      expect(result[1].timeCreated).toEqual(undefined);
      expect(result[1].views).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/1');
      expect(result.timeCreated).toEqual(undefined);
      expect(result.views).toEqual(undefined);
      expect(result.timePublished).toBeTypeOf('string');
    });
  });

  describe('check name on deleted', () => {
    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id');
      expect(result[0].newsName).toEqual(result[0].name);
      expect(result[1].newsName).toEqual(result[1].name);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/1');
      expect(result.newsName).toEqual(result.name);
    });
  });

  describe('check deleted', () => {
    test('DELETE /testNews/1', async () => {
      const { result } = await client.delete('/testNews/1');
      expect(result.ok).toEqual(true);
    });

    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id');
      expect(result[0].newsName).not.toEqual(result[0].name);
      expect(result[0].isDeleted).toEqual(true);
      expect(result[0].name).toEqual('Deleted News');
      expect(result[0].newsName).toEqual('test111');
      expect(result[1].newsName).toEqual(result[1].name);
      expect(result[1].isDeleted).toEqual(false);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/1');
      expect(result.newsName).not.toEqual(result.name);
      expect(result.isDeleted).toEqual(true);
      expect(result.name).toEqual('Deleted News');
      expect(result.newsName).toEqual('test111');
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
