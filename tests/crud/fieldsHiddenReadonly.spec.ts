import { expect, test, describe, beforeAll } from 'bun:test';
import { DateTime } from'luxon';
import { testClient } from '../lib';

const { client } = await testClient({
  migrationDirs: ['./tests/migrations'],
  crudParams: [{
    table: 'testNews',
    fieldRules: {
      hidden: ['timeUpdated', 'typeId'], // they're hidden everywhere and 're also readonly
      readOnly: ['timeCreated', 'views'],
    },
  }],
});

describe('Hidden and Readonly Fields', () => {
  beforeAll(async () => {
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' });
      await client.post('/testNews', { name: 'test112', views: 100, timeCreated: DateTime.fromISO('2024-06-01').toString() });
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
});
