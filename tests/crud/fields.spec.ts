import { expect, test, describe } from 'bun:test';
import { testClient } from '../lib';

describe('GET fields', async () => {
  const { client, theAPI, DateTime } = await testClient({
    migrationDirs: ['./tests/migrations'],
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
          },
          {
            table: 'testTypes',
            where: '"testTypes".id = "testNews"."typeId"',
          },
        ],
      },
      {
        table: 'testNews',
        prefix: 'testAllOnDemand',
        joinOnDemand: [
          {
            table: 'testTypes',
            where: '"testTypes".id = "testNews"."typeId"',
            field: 'name',
            alias: 'typeName',
          },
          {
            table: 'testTypes',
            where: '"testTypes".id = "testNews"."typeId"',
          },
        ],
      },
    ],
  });

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
    });
  });

  describe('GET all', () => {
    test('GET /testNews?_fields=name', async () => {
      const { result } = await client.get('/testNews?_fields=name');
      expect(result).toEqual([
        {
          name: 'test111',
        }, {
          name: 'test112',
        }, {
          name: 'test222',
        }
      ]);
    });

    test('GET /testNews?_fields=id,typeId', async () => {
      const { result } = await client.get('/testNews?_fields=id,typeId');
      expect(result).toEqual([
        {
          id: 1,
          typeId: 1,
        }, {
          id: 2,
          typeId: 1,
        }, {
          id: 3,
          typeId: 2,
        }
      ]);
    });
  });

  describe('GET by id', () => {
    test('GET /testNews/1?_fields=name', async () => {
      const { result } = await client.get('/testNews/1?_fields=name');
      expect(result).toEqual({ name: 'test111'});
    });

    test('GET /testNews/1?_fields=id,typeId', async () => {
      const { result } = await client.get('/testNews/1?_fields=id,typeId');
      expect(result).toEqual({
        id: 1,
        typeId: 1,
      });
    });
  });

  describe('joined', () => {
    test('GET /testAll?_fields=name', async () => {
      const { result } = await client.get('/testAll?_fields=name');
      expect(result).toEqual([
        {
          name: 'test111',
        }, {
          name: 'test112',
        }, {
          name: 'test222',
        }
      ]);
    });

    test('GET /testAll?_fields=name,typeName', async () => {
      const { result } = await client.get('/testAll?_fields=name,typeName');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
        }, {
          name: 'test112',
          typeName: 'type1',
        }, {
          name: 'test222',
          typeName: 'type2',
        }
      ]
      );
    });

    test('GET /testAll?_fields=name,testTypes', async () => {
      const { result } = await client.get('/testAll?_fields=name,testTypes');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
          testTypes: [
            {
              id: 1,
              name: 'type1'
            }
          ],
        }, {
          name: 'test112',
          typeName: 'type1',
          testTypes: [
            {
              id: 1,
              name: 'type1'
            }
          ],
        }, {
          name: 'test222',
          typeName: 'type2',
          testTypes: [
            {
              id: 2,
              name: 'type2'
            }
          ],
        }
      ]
      );
    });
  });

  describe('joined on demand', () => {
    test('GET /testAllOnDemand?_fields=name', async () => {
      const { result } = await client.get('/testAllOnDemand?_fields=name');
      expect(result).toEqual([
        {
          name: 'test111',
        }, {
          name: 'test112',
        }, {
          name: 'test222',
        }
      ]);
    });

    test('GET /testAllOnDemand?_join=typeName&_fields=name,typeName', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=typeName&_fields=name,typeName');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
        }, {
          name: 'test112',
          typeName: 'type1',
        }, {
          name: 'test222',
          typeName: 'type2',
        }
      ]
      );
    });

    test('GET /testAllOnDemand?_join=typeName,testTypes&_fields=name', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=typeName,testTypes&_fields=name');
      expect(result).toEqual([
        {
          name: 'test111',
        }, {
          name: 'test112',
        }, {
          name: 'test222',
        }
      ]
      );
    });

    test('GET /testAllOnDemand?_join=typeName,testTypes&_fields=name,typeName', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=typeName,testTypes&_fields=name,typeName');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
        }, {
          name: 'test112',
          typeName: 'type1',
        }, {
          name: 'test222',
          typeName: 'type2',
        }
      ]
      );
    });

    test('GET /testAllOnDemand?_join=testTypes&_fields=name,typeName', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=testTypes&_fields=name,typeName');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
        }, {
          name: 'test112',
          typeName: 'type1',
        }, {
          name: 'test222',
          typeName: 'type2',
        }
      ]
      );
    });

    test('GET /testAllOnDemand?_join=typeName,testTypes&_fields=name,testTypes', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=typeName,testTypes&_fields=name,testTypes');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
          testTypes: [
            {
              id: 1,
              name: 'type1'
            }
          ],
        }, {
          name: 'test112',
          typeName: 'type1',
          testTypes: [
            {
              id: 1,
              name: 'type1'
            }
          ],
        }, {
          name: 'test222',
          typeName: 'type2',
          testTypes: [
            {
              id: 2,
              name: 'type2'
            }
          ],
        }
      ]
      );
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
