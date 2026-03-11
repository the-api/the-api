import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { testClient } from '../lib';

const { theAPI, client } = await testClient({
  routingOptions: { migrationDirs: ['./tests/migrations'] },
  crudParams: [
    { table: 'testTypes' },
    { table: 'testNews' },
    {
      table: 'testNews',
      prefix: 'testAll',
      join: [
        {
          table: 'testTypes',
          where: '"testTypes".id = "testNews"."typeId"',
          field: 'name',
          alias: 'typeName',
        }
      ]
    },
  ],
});

describe('GET sort', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testNews', { name: 'test111', typeId: 1 });
      await client.post('/testNews', { name: 'test112', typeId: 1, timePublished: DateTime.local().setZone('America/New_York').toString()});
      await client.post('/testNews', { name: 'test222', typeId: 2 });
      await client.post('/testNews', { name: 'test222', typeId: 2 });
    });
  });

  describe('simple', () => {
    test('GET /testNews?_sort=name', async () => {
      const { result } = await client.get('/testNews?_sort=name');
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews?_sort=-name', async () => {
      const { result } = await client.get('/testNews?_sort=-name');
      expect(result[0].name).toEqual('test222');
    });
  });

  describe('nested', () => {
    test('GET /testNews?_sort=-name,-id', async () => {
      const { result } = await client.get('/testNews?_sort=-name,-id');
      expect(result[0].id).toEqual(4);
    });

    test('GET /testNews?_sort=-name,id', async () => {
      const { result } = await client.get('/testNews?_sort=-name,id');
      expect(result[0].id).toEqual(3);
    });
  });

  describe('random', () => {
    test('GET /testNews?_sort=random()', async () => {
      const { result: r1 } = await client.get('/testNews?_sort=random()');
      let r2 = [...r1];
      for(let i = 0; i<100; i++) {
        const { result } = await client.get('/testNews?_sort=random()');
        if (result[0].id != r1[0].id) {
          r2 = result;
          break;
        }
      }
      expect(r1[0].id != r2[0].id).toEqual(true);
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
