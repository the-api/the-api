import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { roles } from 'the-api-roles';
import { Routings, TheAPI } from '../../src';
import { getTestClient } from '../lib';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({
  table: 'testNews',

  hiddenFields: ['timeUpdated', 'typeId'], // they're hidden everywhere and 're also readonly
  readOnlyFields: ['timeCreated', 'views'],
});

const theAPI = new TheAPI({ roles, routings: [router] });
const client = await getTestClient(theAPI);

describe('Hidden and Readonly Fields', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });

    test('create testNews', async () => {
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' });
      await client.post('/testNews', { name: 'test112', views: 100, timeCreated: DateTime.fromISO('2024-06-01').toString() });
    });
  });

  describe('hidden files', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id');
      expect(meta.total).toEqual(2);
      expect(result[0].timeUpdated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2');
      expect(result.typeId).toEqual(undefined);
    });
  });

  describe('readonly', () => {
    test('GET /testNews/2', async () => {
      const { result } = await client.get('/testNews/2');
      expect(result.views).toEqual(0);
      expect(result.timeCreated > '2024-06-02').toEqual(true);
    });

    test('PATCH /testNews/2', async () => {
      const { result } = await client.patch('/testNews/2', { views: 100, timeCreated: DateTime.fromISO('2024-06-01').toString() });
      expect(result.views).toEqual(0);
      expect(result.timeCreated > '2024-06-02').toEqual(true);
    });

    test('GET /testNews/2', async () => {
      const { result } = await client.get('/testNews/2');
      expect(result.views).toEqual(0);
      expect(result.timeCreated > '2024-06-02').toEqual(true);
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
