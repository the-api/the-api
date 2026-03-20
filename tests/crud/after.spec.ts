import { expect, test, describe, beforeAll } from 'bun:test';
import { testClient } from '../lib';

const { client, DateTime } = await testClient({
  migrationDirs: ['./tests/migrations'],
  crudParams: [
    { table: 'testTypes' },
    { table: 'testNews' },
  ],
});

describe('GET after', () => {
  beforeAll(async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testNews', { name: 'test111', typeId: 1 });
      await new Promise(resolve => setTimeout(resolve, 10));
      await client.post('/testNews', { name: 'test112', typeId: 1, timePublished: DateTime.local().setZone('America/New_York').toString()});
      await new Promise(resolve => setTimeout(resolve, 10));
      await client.post('/testNews', { name: 'test222', typeId: 2 });
  });

  describe('after by timeCreated, limit 1', () => {
    let nextAfter: string;
    test('GET /testNews?_limit=1&_sort=timeCreated', async () => {
      const { meta, result } = await client.get('/testNews?_limit=1&_sort=timeCreated');
      ({ nextAfter } = meta);
      expect(meta).toEqual({
        nextAfter,
        total: 3,
        limit: 1,
        skip: 0,
        page: 1,
        nextPage: 2,
        pages: 3,
        isFirstPage: true,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(1);
    });

    test('GET /testNews?_limit=1&_sort=timeCreated&_after=nextAfter', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=1&_sort=timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(2);
    });

    test('GET /testNews?_limit=1&_sort=timeCreated&_after=nextAfter', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=1&_sort=timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(3);
    });

    test('GET /testNews?_limit=1&_sort=timeCreated&_after=nextAfter', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=1&_sort=timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result).toEqual([]);
    });
  });

  describe('after by timeCreated desc, limit 2', () => {
    let nextAfter: string;
    test('GET /testNews?_limit=2&_sort=-timeCreated', async () => {
      const { meta, result } = await client.get('/testNews?_limit=2&_sort=-timeCreated');
      ({ nextAfter } = meta);
      expect(meta).toEqual({
        nextAfter,
        total: 3,
        limit: 2,
        skip: 0,
        page: 1,
        nextPage: 2,
        pages: 2,
        isFirstPage: true,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(3);
      expect(result[1].id).toEqual(2);
    });

    test('GET /testNews?_limit=2&_sort=-timeCreated&_after=nextAfter1', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=2&_sort=-timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result[0].id).toEqual(1);
    });

    test('GET /testNews?_limit=2&_sort=-timeCreated&_after=nextAfter2', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=2&_sort=-timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result).toEqual([]);
    });
  });

  describe('after by timeCreated desc, limit 2', () => {
    let nextAfter: string;
    test('GET /testNews?_limit=2&_sort=-id', async () => {
      const { meta, result } = await client.get('/testNews?_limit=2&_sort=-id');
      ({ nextAfter } = meta);
      expect(meta).toEqual({
        nextAfter,
        total: 3,
        limit: 2,
        skip: 0,
        page: 1,
        nextPage: 2,
        pages: 2,
        isFirstPage: true,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(3);
      expect(result[1].id).toEqual(2);
    });

    test('GET /testNews?_limit=2&_sort=-id&_after=nextAfter1', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=2&_sort=-id&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result[0].id).toEqual(1);
    });

    test('GET /testNews?_limit=2&_sort=-id&_after=nextAfter2', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=2&_sort=-id&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result).toEqual([]);
    });
  });
});
