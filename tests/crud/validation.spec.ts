import { describe, expect, test } from 'bun:test';
import { testClient } from '../../tests/lib';

const migrationDirs = ['./tests/migrations'];

const crudParams = [
  {
    table: 'messages',
    prefix: 'messagesAuto',
  },
  {
    table: 'messages',
    prefix: 'messagesCustomBody',
    validation: {
      body: {
        post: {
          warningLevel: { type: 'number', min: 1, max: 3 },
          body: { type: 'string', required: true },
        },
      },
    },
  },
  {
    table: 'messages',
    prefix: 'messagesNoValidation',
    validation: {},
  },
  {
    table: 'messages',
    prefix: 'messagesNoParamsValidation',
    validation: {
      params: {},
    },
  },
  {
    table: 'messages',
    prefix: 'messagesFunctionValidation',
    validation: {
      body: {
        post: () => ({
          warningLevel: { type: 'number', min: 0, max: 2 },
          body: { type: 'string', required: true },
        }),
        patch: () => ({
          validate: (value: unknown) => {
            const data = (value || {}) as Record<string, unknown>;
            if (typeof data.warningLevel === 'undefined') return true;
            if (typeof data.warningLevel === 'number' && data.warningLevel <= 5) return true;

            return [{
              field: 'warningLevel',
              message: 'warningLevel must be a number less than or equal to 5',
              expected: { type: 'number', max: 5 },
              value: data.warningLevel,
            }];
          },
        }),
      },
    },
  }
];

const { theAPI, client } = await testClient({
  migrationDirs,
  crudParams,
});

describe('crud validation', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('auto validation returns all errors for POST body', async () => {
    const { result } = await client.post('/messagesAuto', {});

    expect(result.name).toEqual('VALIDATION_ERROR');
    expect(result.status).toEqual(400);
    expect(result.code).toEqual(22);
    expect(Array.isArray(result.additional)).toEqual(true);

    const additional = result.additional as Array<Record<string, unknown>>;
    const fields = additional.map((item) => item.field);

    expect(fields).toContain('body.warningLevel');
    expect(fields).toContain('body.body');

    expect(additional.find((item) => item.field === 'body.warningLevel')?.expected).toEqual({
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    });
  });

  test('auto validation checks query schema from columns', async () => {
    const { result } = await client.get('/messagesAuto?_sort=-unknownField');

    expect(result.name).toEqual('VALIDATION_ERROR');
    expect(result.status).toEqual(400);
    expect((result.additional as Array<Record<string, unknown>>)[0]?.field).toEqual('query._sort[0]');
  });

  test('auto validation checks params id type', async () => {
    const { result } = await client.get('/messagesAuto/not-a-number');

    expect(result.name).toEqual('VALIDATION_ERROR');
    expect(result.status).toEqual(400);
    expect((result.additional as Array<Record<string, unknown>>)[0]?.field).toEqual('params.id');
  });

  test('custom body schema overrides auto and keeps other sections auto', async () => {
    const createOk = await client.post('/messagesCustomBody', { warningLevel: 2, body: 'ok' });
    expect(createOk.error).toEqual(false);

    const badCustom = await client.post('/messagesCustomBody', { warningLevel: 0, body: 'x' });
    expect(badCustom.result.name).toEqual('VALIDATION_ERROR');
    expect((badCustom.result.additional as Array<Record<string, unknown>>)[0]?.field).toEqual('body.warningLevel');

    const badSort = await client.get('/messagesCustomBody?_sort=badField');
    expect(badSort.result.name).toEqual('VALIDATION_ERROR');
    expect((badSort.result.additional as Array<Record<string, unknown>>)[0]?.field).toEqual('query._sort[0]');

    const patchWithoutRequired = await client.patch(`/messagesCustomBody/${createOk.result.id}`, {});
    expect(patchWithoutRequired.error).toEqual(false);
  });

  test('validation:{} disables validation', async () => {
    await client.post('/messagesNoValidation', { warningLevel: 1, body: 'seed' });
    const { error, result } = await client.get('/messagesNoValidation?_sort=-unknownField');

    expect(error).toEqual(false);
    expect(Array.isArray(result)).toEqual(true);
  });

  test('validation.params:{} disables params only', async () => {
    const { result } = await client.patch('/messagesNoParamsValidation/not-a-number', { warningLevel: 'high' });

    expect(result.name).toEqual('VALIDATION_ERROR');

    const fields = (result.additional as Array<Record<string, unknown>>).map((item) => item.field);
    expect(fields).toContain('body.warningLevel');
    expect(fields).not.toContain('params.id');
  });

  test('body.post/body.patch can be functions', async () => {
    const badPost = await client.post('/messagesFunctionValidation', { warningLevel: 3, body: 123 as never });
    expect(badPost.result.name).toEqual('VALIDATION_ERROR');

    const created = await client.post('/messagesFunctionValidation', { warningLevel: 2, body: 'ok' });
    expect(created.error).toEqual(false);

    const badPatch = await client.patch(`/messagesFunctionValidation/${created.result.id}`, { warningLevel: 9 });
    expect(badPatch.result.name).toEqual('VALIDATION_ERROR');

    const details = badPatch.result.additional as Array<Record<string, unknown>>;
    expect(details[0]?.field).toEqual('body.warningLevel');
    expect(details[0]?.message).toEqual('warningLevel must be a number less than or equal to 5');
  });

  test('finalize', async () => {
    await client.deleteTables();
  });
});
