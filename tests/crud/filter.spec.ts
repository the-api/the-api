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

describe('GET filters', () => {
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

  describe('simple', () => {
    test('GET /testNews', async () => {
      const { meta } = await client.get('/testNews');
      expect(meta.total).toEqual(3);
    });

    test('GET /testNews?name=test112', async () => {
      const { result, meta } = await client.get('/testNews?name=test112');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?name=test112&name=test222', async () => {
      const { meta } = await client.get('/testNews?name=test112&name=test222');
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?_in_name=encodeURIComponent([\'test112\',\'test222\'])', async () => {
      const data = encodeURIComponent(JSON.stringify(['test112','test222']));
      const { meta } = await client.get(`/testNews?_in_name=${data}`);
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?_in_name=[\'test112\',\'test222\']', async () => {
      const { meta } = await client.get(`/testNews?_in_name=["test112","test222"]`);
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?_not_in_name=encodeURIComponent([\'test112\',\'test222\'])', async () => {
      const data = encodeURIComponent(JSON.stringify(['test112','test222']));
      const { meta } = await client.get(`/testNews?_not_in_name=${data}`);
      expect(meta.total).toEqual(1);
    });

    test('GET /testNews?_not_in_name=[\'test112\',\'test222\']', async () => {
      const { meta } = await client.get(`/testNews?_not_in_name=["test112","test222"]`);
      expect(meta.total).toEqual(1);
    });

    test('GET /testNews?typeId=1', async () => {
      const { meta } = await client.get('/testNews?typeId=1');
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?typeId=1&name=test111', async () => {
      const { result, meta } = await client.get('/testNews?typeId=1&name=test111');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews?name~=test%22', async () => {
      const { result, meta } = await client.get('/testNews?name~=test%2522');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?name!=test111', async () => {
      const { meta } = await client.get('/testNews?name!=test111');
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?name!=test111&name!=test112', async () => {
      const { result, meta } = await client.get('/testNews?name!=test111&name!=test112');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?typeId=2', async () => {
      const { result, meta } = await client.get('/testNews?typeId=2');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });
  });

  describe('not so simple', () => {
    test('GET /testNews?_from_typeId=2', async () => {
      const { result, meta } = await client.get('/testNews?_from_typeId=2');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?_to_typeId=1', async () => {
      const { meta } = await client.get('/testNews?_to_typeId=1');
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?_from_name=test1999', async () => {
      const { result, meta } = await client.get('/testNews?_from_name=test1999');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?_from_timeCreated=...&_to_timeCreated=...', async () => {
      const from = DateTime.now().minus({ day: 1 }).toFormat('yyyy-MM-dd');
      const to = DateTime.now().plus({ day: 1 }).toFormat('yyyy-MM-dd');
      const { meta } = await client.get(`/testNews?_from_timeCreated=${from}&_to_timeCreated=${to}`);
      expect(meta.total).toEqual(3);
    });

    test('GET /testNews?_not_null_timePublished=true', async () => {
      const { result, meta } = await client.get('/testNews?_not_null_timePublished=true');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?_to_timePublished=...', async () => {
      const now = encodeURIComponent(DateTime.now().toISO());
      const { result, meta } = await client.get(`/testNews?_to_timePublished=${now}`);
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?_to_timePublished=NOW()', async () => {
      const { result, meta } = await client.get('/testNews?_to_timePublished=NOW()');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?_null_timePublished=true', async () => {
      const { meta } = await client.get('/testNews?_null_timePublished=true');
      expect(meta.total).toEqual(2);
    });
  });

  describe('by joined data', () => {
    test('GET /testAll?typeName=type2', async () => {
      const { result } = await client.get('/testAll?typeName=type2');
      expect(result[0].typeName).toEqual('type2');
    });

    test('GET /testAll?typeName=type1&typeName=type2', async () => {
      const { meta } = await client.get('/testAll?typeName=type1&typeName=type2');
      expect(meta.total).toEqual(3);
    });

    test('GET /testAll?typeName=type1&typeName=typex', async () => {
      const { meta } = await client.get('/testAll?typeName=type1&typeName=typex');
      expect(meta.total).toEqual(2);
    });

    test('GET /testAll?typeName=type1&typeName=type2', async () => {
      const { result } = await client.get('/testAll?typeName=type1&name=test112');
      expect(result[0].name).toEqual('test112');
    });
  });

  describe('empty results', () => {
    test('GET /testNews?name=test000', async () => {
      const { meta } = await client.get('/testNews?name=test000');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?typeId=2&name=test111', async () => {
      const { meta } = await client.get('/testNews?typeId=2&name=test111');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_from_name=test999', async () => {
      const { meta } = await client.get('/testNews?_from_name=test999');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_to_name=test11', async () => {
      const { meta } = await client.get('/testNews?_to_name=test11');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_from_timeCreated=...', async () => {
      const to = DateTime.now().plus({ day: 1 }).toFormat('yyyy-MM-dd');
      const { meta } = await client.get(`/testNews?_from_timeCreated=${to}`);
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_to_timeCreated=...', async () => {
      const from = DateTime.now().minus({ day: 1 }).toFormat('yyyy-MM-dd');
      const { meta } = await client.get(`/testNews?_to_timeCreated=${from}`);
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_not_null_timeUpdated=true', async () => {
      const { meta } = await client.get('/testNews?_not_null_timeUpdated=true');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_from_timePublished=NOW()', async () => {
      const { meta } = await client.get('/testNews?_from_timePublished=NOW()');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_in_name=[\'test112\',\'test222\']', async () => {
      const { error } = await client.get(`/testNews?_in_name=['test112','test222']`);
      expect(error).toEqual(true);
    });

    test('GET /testAll?typeName=typex', async () => {
      const { meta } = await client.get('/testAll?typeName=typex');
      expect(meta.total).toEqual(0);
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
