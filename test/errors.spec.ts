import { describe, expect, test } from 'bun:test';
import { getTestClient } from './lib';
import { Routings, TheAPI } from '../src';
import { errors } from '../src/middlewares';

const router = new Routings();

router.get('/exception', async (c: any) => {
  c.this.line.throws.error();
});

router.get('/error', async () => {
  throw new Error('throw error');
});

router.get('/user-defined-error', async () => {
  throw new Error('USER_DEFINED_ERROR');
});

router.get('/user-defined-error-addition', async (c: any) => {
  try {
    c.some.path();
  } catch (err) {
    throw new Error('USER_DEFINED_ERROR: additional information');
  }
});

router.get('/user-defined-error-message-meta', async (c: any) => {
  try {
    c.some.path();
  } catch {
    c.set('meta', { x: 3 });
    throw new Error('error message');
  }
});

router.errors({
  USER_DEFINED_ERROR: {
    code: 55,
    status: 403,
    description: 'user defined error',
  }
});

const theAPI = new TheAPI({ routings: [errors, router] });
const client = await getTestClient(theAPI);

describe('errors', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('GET /not/found', async () => {
    const { result, ...r } = await client.get('/not/found');

    expect(result.error).toEqual(true);
    expect(result.status).toEqual(404);
  });

  test('GET /exception', async () => {
    const { result } = await client.get('/exception');

    expect(result.error).toEqual(true);
    expect(result.description).toEqual('An unexpected error occurred');
    expect(result.status).toEqual(500);
    expect(result.code).toEqual(11);
  });

  test('GET /error', async () => {
    const { result } = await client.get('/error');

    expect(result.error).toEqual(true);
    expect(result.name).toEqual('throw error');
    expect(result.description).toEqual('An unexpected error occurred');
    expect(result.status).toEqual(500);
    expect(result.code).toEqual(11);
  });

  test('GET /user-defined-error', async () => {
    const { result } = await client.get('/user-defined-error');

    expect(result.error).toEqual(true);
    expect(result.description).toEqual('user defined error');
    expect(result.status).toEqual(403);
    expect(result.code).toEqual(55);
  });

  test('GET /user-defined-error-addition', async () => {
    const { result } = await client.get('/user-defined-error-addition');

    expect(result.error).toEqual(true);
    expect(result.description).toEqual('user defined error');
    expect(result.additional).toEqual('additional information');
    expect(result.status).toEqual(403);
    expect(result.code).toEqual(55);
  });

  test('GET /user-defined-error-message-meta', async () => {
    const { result, meta } = await client.get('/user-defined-error-message-meta');

    expect(result.error).toEqual(true);
    expect(result.description).toEqual('An unexpected error occurred');
    expect(result.name).toEqual('error message');
    expect(result.status).toEqual(500);
    expect(result.code).toEqual(11);
    expect(meta).toEqual({ x: 3 });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});