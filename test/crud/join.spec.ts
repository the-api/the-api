import { expect, test, describe } from 'bun:test';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'testTypes' });
router.crud({ table: 'testTypeAges' });
router.crud({ table: 'testNews' });
router.crud({
  table: 'testNews',
  prefix: 'testJoin',
  join: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testAs',
  join: [
    {
      table: 'testNews',
      as: 'testNews2',
      where: '"testNews2".id = "testNews"."id"',
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testAlias',
  join: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
      field: 'name',
      alias: 'typeName',
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testOnDemand',
  joinOnDemand: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
      field: 'name',
      alias: 'typeName',
    }
  ]
});
router.get('/testWhereBindings', async (c, n) => {
  c.set('_typeName' as any, 'type1');
  await n();
});
router.get('/testWhereBindings/:id', async (c, n) => {
  c.set('_typeName' as any, 'type2');
  await n();
});
router.crud({
  table: 'testNews',
  prefix: 'testWhereBindings',
  join: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId" AND "testTypes".name = :typeName',
      whereBindings: { typeName: 'env._typeName' },
      defaultValue: '[{ "name": "noType" }]',
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testWithLatestNewsInTheSameCategory',
  join: [
    {
      table: 'testNews',
      as: 'latestNewsInCategory',
      alias: 'latestNewsInCategory',
      where: '"latestNewsInCategory"."typeId" = "testNews"."typeId" AND "latestNewsInCategory".id != "testNews".id',
      fields: ['name', 'timeCreated'],
      limit: 1,
      orderBy: '"timeCreated" DESC',
      byIndex: 0,
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testLeftJoin',
  join: [
    {
      table: 'testTypes',
      alias: 'ages',
      where: '"testTypes".id = "testNews"."typeId"',
      leftJoin: ['testTypeAges', '"testTypeAges"."typeId"', '"testTypes".id'],
      orderBy: '"testTypeAges".id DESC',
      fields: ['name', 'age'],
    }
  ]
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET join', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testTypeAges', { typeId: 1, age: '7-15' });
      await client.post('/testTypeAges', { typeId: 1, age: '16-21' });
      await client.post('/testTypeAges', { typeId: 2, age: '16-21' });
      await client.post('/testTypeAges', { typeId: 2, age: '22-99' });
      await client.post('/testNews', { name: 'test111', typeId: 1 });
      await client.post('/testNews', { name: 'test112', typeId: 1 });
      await client.post('/testNews', { name: 'test222', typeId: 2 });
    });
  });

  describe('join', () => {
    test('GET /testJoin?_sort=name', async () => {
      const { result } = await client.get('/testJoin?_sort=name');
      expect(result[0].testTypes).toEqual([{ id: 1, name: 'type1' }]);
    });

    test('GET /testJoin?_fields=name,testTypes&_sort=name', async () => {
      const { result } = await client.get('/testJoin?_fields=name,testTypes&_sort=-name');
      expect(result[0].testTypes).toEqual([{ id: 2, name: 'type2' }]);
    });

    test('GET /testJoin/1', async () => {
      const { result } = await client.get('/testJoin/1');
      expect(result.testTypes).toEqual([{ id: 1, name: 'type1' }]);
    });

    test('GET /testJoin/3', async () => {
      const { result } = await client.get('/testJoin/3');
      expect(result.testTypes).toEqual([{ id: 2, name: 'type2' }]);
    });
  });

  describe('as', () => {
    test('GET /testAs?_sort=name', async () => {
      const { result } = await client.get('/testAs?_sort=name');
      expect(result[0].testNews[0].name).toEqual('test111');
    });

    test('GET /testAs?_fields=name,testTypes&_sort=name', async () => {
      const { result } = await client.get('/testAs?_fields=name,testNews&_sort=-name');
      expect(result[0].testNews[0].name).toEqual('test222');
    });

    test('GET /testAs/1', async () => {
      const { result } = await client.get('/testAs/1');
      expect(result.testNews[0].name).toEqual('test111');
    });

    test('GET /testAs/3', async () => {
      const { result } = await client.get('/testAs/3');
      expect(result.testNews[0].name).toEqual('test222');
    });
  });

  describe('alias', () => {
    test('GET /testAlias?_sort=name', async () => {
      const { result } = await client.get('/testAlias?_sort=name');
      expect(result[0].typeName).toEqual('type1');
    });

    test('GET /testAlias?_sort=name', async () => {
      const { result } = await client.get('/testAlias?_fields=name,typeName&_sort=-name');
      expect(result[0].typeName).toEqual('type2');
    });

    test('GET /testAlias/1', async () => {
      const { result } = await client.get('/testAlias/1');
      expect(result.typeName).toEqual('type1');
    });

    test('GET /testAlias/3', async () => {
      const { result } = await client.get('/testAlias/3');
      expect(result.typeName).toEqual('type2');
    });
  });

  describe('on demand', () => {
    test('GET /testOnDemand?_sort=name', async () => {
      const { result } = await client.get('/testOnDemand?_join=testTypes&_fields=name,typeName&_sort=name');
      expect(result[0].typeName).toEqual('type1');
    });

    test('GET /testOnDemand/1', async () => {
      const { result } = await client.get('/testOnDemand/1?_join=testTypes&_fields=name,typeName');
      expect(result.typeName).toEqual('type1');
    });

    test('GET /testOnDemand?_sort=name', async () => {
      const { error } = await client.get('/testOnDemand?_fields=name,typeName&_sort=name');
      expect(error).toEqual(true);
    });
  });

  describe('bindings', () => {
    test('GET /testWhereBindings?_sort=name', async () => {
      const { result } = await client.get('/testWhereBindings?_sort=name');
      expect(result[0].testTypes[0].name).toEqual('type1');
      expect(result[2].testTypes[0].name).toEqual('noType');
    });

    test('GET /testWhereBindings/1', async () => {
      const { result } = await client.get('/testWhereBindings/1');
      expect(result.testTypes[0].name).toEqual('noType');
    });

    test('GET /testWhereBindings/3', async () => {
      const { result } = await client.get('/testWhereBindings/3');
      expect(result.testTypes[0].name).toEqual('type2');
    });
  });

  describe('latest news in the same category', () => {
    test('GET /testWithLatestNewsInTheSameCategory?_sort=name', async () => {
      const { result } = await client.get('/testWithLatestNewsInTheSameCategory?_sort=name');
      expect(result[0].latestNewsInCategory.name).toEqual('test112');
      expect(result[1].latestNewsInCategory.name).toEqual('test111');
      expect(result[2].latestNewsInCategory).toEqual(null);
    });

    test('GET /testWithLatestNewsInTheSameCategory/1', async () => {
      const { result } = await client.get('/testWithLatestNewsInTheSameCategory/1');
      expect(result.latestNewsInCategory.name).toEqual('test112');
    });

    test('GET /testWithLatestNewsInTheSameCategory/3', async () => {
      const { result } = await client.get('/testWithLatestNewsInTheSameCategory/3');
      expect(result.latestNewsInCategory).toEqual(null);
    });
  });

  describe('left join', () => {
    test('GET /testLeftJoin?_sort=name', async () => {
      const { result } = await client.get('/testLeftJoin?_sort=name');
      expect(result[0].ages).toEqual([
        {
          age: "16-21",
          name: "type1",
        }, {
          age: "7-15",
          name: "type1",
        }
      ]);
      expect(result[2].ages).toEqual([
        {
          age: "22-99",
          name: "type2",
        }, {
          age: "16-21",
          name: "type2",
        }
      ]);
    });

    test('GET /testLeftJoin/1', async () => {
      const { result } = await client.get('/testLeftJoin/1');
      expect(result.ages).toEqual([
        {
          age: "16-21",
          name: "type1",
        }, {
          age: "7-15",
          name: "type1",
        }
      ]);
    });

    test('GET /testLeftJoin/3', async () => {
      const { result } = await client.get('/testLeftJoin/3');
      expect(result.ages).toEqual([
        {
          age: "22-99",
          name: "type2",
        }, {
          age: "16-21",
          name: "type2",
        }
      ]);
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
