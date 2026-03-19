import { expect, test, describe, beforeAll } from 'bun:test';
import { testClient } from '../lib';

const { client } = await testClient({
  routingOptions: { migrationDirs: ['./tests/migrations'] },
  crudParams: [{
    table: 'testNews',
    searchFields: ['name'],
  }],
});

describe('GET search', () => {
  beforeAll(async () => {
      await client.post('/testNews', { name: 'test111' });
      await client.post('/testNews', { name: 'test112' });
      await client.post('/testNews', { name: 'test222' });
      await client.post('/testNews', { name: '测试222' });
  });

  describe('exact search', () => {
    test('GET /testNews?_search=test222', async () => {
      const { result } = await client.get('/testNews?_search=test222');
      expect(result[0].name).toEqual('test222');
    });
  });

  describe('search 1 typo', () => {
    test('GET /testNews?_search=tst111', async () => {
      const { result } = await client.get('/testNews?_search=tst111');
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews?_search=t%20st112', async () => {
      const { result } = await client.get('/testNews?_search=t%20st112');
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?_search=tust222', async () => {
      const { result } = await client.get('/testNews?_search=tust222');
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?_search=etst111', async () => {
      const { result } = await client.get('/testNews?_search=etst111');
      expect(result[0].name).toEqual('test111');
    });
  });

  describe('search 1 typos and 1 insert/delete', () => {
    test('GET /testNews?_search=tst22', async () => {
      const { result } = await client.get('/testNews?_search=tst22');
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?_search=t%20st1113', async () => {
      const { result } = await client.get('/testNews?_search=t%20st1113');
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews?_search=tust22', async () => {
      const { result } = await client.get('/testNews?_search=tust22');
      expect(result[0].name).toEqual('test222');
    });
  });

  describe('search unicode', () => {
    test('GET /testNews?_search=测试222', async () => {
      const { result } = await client.get('/testNews?_search=测试222');
      expect(result[0].name).toEqual('测试222');
    });

    test('GET /testNews?_search=测%22222', async () => {
      const { result } = await client.get('/testNews?_search=测%22222');
      expect(result[0].name).toEqual('测试222');
    });

    test('GET /testNews?_search=测试试22', async () => {
      const { result } = await client.get('/testNews?_search=测试试22');
      expect(result[0].name).toEqual('测试222');
    });
  });
});
