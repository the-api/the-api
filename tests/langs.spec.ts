import { describe, expect, test, beforeAll } from 'bun:test';
import { testClient } from './lib';
import { langs } from 'the-api-langs';

const { client } = await testClient({
  routingOptions: { migrationDirs: ['./tests/migrations'] },
  routings: [langs],
  crudParams: [
    { table: 'langs' },
    {
      table: 'testNews',
      translate: ['name'],
      searchFields: ['name'],
    },
  ],
});

describe('langs', () => {
  beforeAll(async () => {
      await client.post('/langs', { textKey: 1, lang: 'en', text: 'test111' });
      await client.post('/langs', { textKey: 1, lang: 'cn', text: '测试111' });
      await client.post('/langs', { textKey: 2, lang: 'en', text: 'test222' });
      await client.post('/langs', { textKey: 2, lang: 'cn', text: '测试222' });
      await client.post('/testNews', { name: 'test111' });
      await client.post('/testNews', { name: 'test222' });
  });

  describe('translate', () => {
    test('GET /testNews?_lang=cn', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn');
      expect(result).toEqual([
        {
          name: "测试111",
        }, {
          name: "测试222",
        }      
      ]);
    });

    test('GET /testNews/1?_fields=name&_lang=cn', async () => {
      const { result } = await client.get('/testNews/1?_fields=name&_lang=cn');
      expect(result).toEqual({ name: "测试111" });
    });

    test('GET /testNews/1?_fields=name&_lang=cn&name=测试111', async () => {
      const { result } = await client.get('/testNews/1?_fields=name&_lang=cn');
      expect(result).toEqual({ name: "测试111" });
    });

    test('GET /testNews?_lang=en&name=test111', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=en&name=test111');
      expect(result).toEqual([
        {
          name: "test111",
        }      
      ]);
    });

    test('GET /testNews?_fields=name&_lang=cn&name=test111', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&name=test111');
      expect(result).toEqual([]);
    });

    test('GET /testNews?_lang=cn&_search=test11', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&_search=test11');
      expect(result).toEqual([]);
    });

    test('GET /testNews?_lang=cn&name=测试111', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&name=测试111');
      expect(result).toEqual([
        {
          name: "测试111",
        }      
      ]);
    });

    test('GET /testNews?_lang=cn&_search=测试11', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&_search=测试11');
      expect(result[0].name).toEqual('测试111');
    });

    test('GET /testNews?_lang=cn&_search=测111', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&_search=测111');
      expect(result[0].name).toEqual('测试111');
    });
  });
});
